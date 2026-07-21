package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.service.ai.LlmErrors;
import com.example.popspotbackend.service.ai.LlmFailureKind;
import com.example.popspotbackend.service.ai.LlmQuotaExhaustedException;
import com.example.popspotbackend.service.ai.LlmUsageTracker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.model.output.TokenUsage;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 검색 API 결과(snippet 들)를 LLM 에 넘겨 구조화된 {@link NormalizedPopup} 목록으로 정규화.
 *
 * <p>v2.33 — 한 번의 LLM 호출로 snippet 묶음 안의 <b>서로 다른 팝업을 전부</b> 추출한다(JSON 배열). 이전엔 키워드당 팝업 1개만 뽑아 수집량이
 * 병목이었다 — 같은 API 로 이미 가져온 snippet 을 더 깊게 활용해 추가 크롤/쿼터 없이 수확만 끌어올린다. confidence 점수는 팝업마다 LLM 이 직접
 * 매기고, 0.8 게이트/중복제거/PII 규칙은 그대로 유지된다.
 *
 * <p>토큰과 Groq TPM 을 아끼기 위해 snippet 은 {@link #DEFAULT_MAX_SNIPPETS_PER_REQUEST} 개까지만 프롬프트에 넣는다(호출 수는
 * 키워드당 1회로 고정).
 */
@Slf4j
@Service
public class PopupNormalizationService {

    /**
     * LLM 한 번에 넘길 스니펫 수(기본값). {@code popspot.crawler.max-snippets-per-request} 로 조정한다.
     *
     * <p>한때 90 으로 올렸다가 40 으로 되돌렸고, 이제 12 로 낮춘다. 근거는 실측이다 — gpt-oss-20b 로 스니펫 40 개를 넣으니 호출당 약 7,810
     * 토큰(입력 5,762 + 출력 2,048)이 나왔는데, 무료 티어의 <b>분당 토큰(TPM)이 8,000</b>이라 한 호출이 1 분 예산을 거의 다 태웠다. 큰
     * 회차는 단일 요청이 8,060 으로 한도 자체를 넘겨 즉시 거부됐다. 스니펫을 줄이면 호출당 토큰이 줄어 분당 여러 번 호출할 수 있고, 고정된 일일 토큰(TPD)으로
     * 하루에 더 많은 키워드를 처리한다.
     *
     * <p>추론 모델이라 출력 토큰(≈2,048)이 스니펫 수와 무관하게 붙는 게 다음 병목이다. 그건 별도로 {@code reasoning_effort} 를 낮춰 다뤄야
     * 한다.
     */
    public static final int DEFAULT_MAX_SNIPPETS_PER_REQUEST = 12;

    /** 실측으로 조정 가능한 실제 상한. {@link #DEFAULT_MAX_SNIPPETS_PER_REQUEST} 참고. */
    @Value("${popspot.crawler.max-snippets-per-request:" + DEFAULT_MAX_SNIPPETS_PER_REQUEST + "}")
    private int maxSnippetsPerRequest;

    /** 성공 없이 이 횟수만큼 연속 실패하면 크롤을 멈춘다. 원인을 몰라도 계속 돌 이유가 없다. */
    private static final int MAX_CONSECUTIVE_FAILURES = 5;

    private static final String DEFAULT_CATEGORY = "ETC";
    private static final String SEOUL_KEYWORD = "서울";

    // v2.22 — 크롤링 텍스트 정제용 길이 상한. HTML 태그 제거와 함께 저장형 XSS 2중 방어 + DB 보호.
    private static final int MAX_NAME_LEN = 120;
    private static final int MAX_LOCATION_LEN = 200;
    private static final int MAX_DESC_LEN = 300;
    private static final int MAX_CONTENT_LEN = 2000;

    private static final String ERROR_EMPTY_NAME = "EMPTY_NAME";
    private static final String ERROR_NOT_IN_SEOUL = "NOT_IN_SEOUL";

    private static final String PROMPT_TEMPLATE =
            """
            너는 한국 서울에서 열리는 팝업스토어 정보를 정리하는 어시스턴트야.
            아래 번호가 매겨진 검색 결과 snippet 들을 읽고, 그 안에 등장하는 "서로 다른" 서울 팝업스토어를
            모두 찾아 JSON 배열로 출력해.

            오늘 날짜: %s
            검색 결과 snippet (각 줄은 "번호. [출처] 제목 : 요약" 형태):
            %s

            출력 규칙:
            1) 반드시 JSON 배열 한 개만 출력. 마크다운 코드펜스 / 설명문 절대 금지. 예: [ {...}, {...} ]
            2) 배열의 각 원소 = 서로 다른 팝업스토어 1개. 같은 팝업을 두 번 넣지 마. 팝업이 하나도 없으면 빈 배열 [].
            3) 각 원소 필드:
               - name (string, 필수): 팝업 정식 이름. 명확하지 않으면 그 팝업은 배열에서 빼.
               - location (string): 서울 내 주소. 모르면 "서울"만.
               - category (string): FASHION / FOOD / CULTURE / CHARACTER / BEAUTY / TECH / ETC 중 하나.
               - startDate (string): YYYY-MM-DD. 모르면 null.
               - endDate (string): YYYY-MM-DD. 모르면 null.
               - officialUrl (string): snippet 에 팝업 공식 홈페이지/공식 SNS/예약 페이지 URL 이 그대로 적혀 있으면 그 URL. 없으면 null. 절대 지어내지 마.
               - reservationUrl (string): snippet 에 예약/신청 링크 URL 이 그대로 적혀 있으면 그 URL. 없으면 null. 절대 지어내지 마.
               - description (string): 50자 내외 한 줄 설명.
               - content (string): 200자 내외 상세 설명.
               - confidence (number 0.0 ~ 1.0): name 명확 +0.3, location 구 단위 이상 +0.2,
                 startDate/endDate 둘 다 명확 +0.3, 출처 2개 이상에서 같은 정보 +0.1, 카테고리 명확 +0.1.
               - sourceIndex (number): 이 팝업의 근거가 된 snippet 의 번호(위 목록의 번호). 여러 개면 가장 대표적인 1개.
               - error (string|null): 보통 null.
            4) 서울이 아닌 팝업은 배열에서 제외. 팝업 이름·존재가 확실하지 않으면 넣지 마 — 물량보다 정확도 우선(애매하면 버려).
            5) 개인정보 보호 — description/content 에 다음 절대 포함 금지:
               운영자 휴대폰 번호 / 이메일 / 인스타 DM 안내 같은 개인 연락처,
               블로그 작성자 닉네임·실명, 후기를 쓴 개인의 인적사항.
               필요하면 "공식 SNS 참고" 같은 일반 표현으로 대체.
            6) description/content 는 검색 스니펫의 문장을 그대로 베끼지 말고 너의 표현으로 요약해.
            7) 각 팝업의 날짜·장소·카테고리는 그 팝업을 다룬 snippet 에서만 가져와 — 한 팝업의 정보를
               다른 팝업에 섞지 마(교차오염 금지). 같은 팝업이 이름만 조금 다르게 여러 번 나오면 하나로 합쳐.

            예시 출력:
            [{"name":"○○ 팝업스토어","location":"서울 성동구 성수동","category":"FASHION","startDate":"2026-05-01","endDate":"2026-05-31","description":"○○ 브랜드 신상 컬렉션 팝업","content":"...","confidence":0.85,"sourceIndex":3,"error":null}]
            """;

    private final ChatLanguageModel chatLanguageModel;
    private final LlmUsageTracker usageTracker;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 크롤러 전용 모델을 명시 주입한다.
     *
     * <p>Lombok {@code @RequiredArgsConstructor} 는 필드의 {@code @Qualifier} 를 생성자 파라미터로 복사하지 않는다
     * (프로젝트에 {@code lombok.config} 의 {@code copyableAnnotations} 설정이 없다). 그래서 이 클래스만 생성자를 직접 쓴다. 안
     * 그러면 {@code @Primary} 인 사용자 모델이 주입되어 크롤러가 사용자 기능의 토큰 예산을 먹는다.
     */
    public PopupNormalizationService(
            @Qualifier("crawlerChatModel") ChatLanguageModel chatLanguageModel,
            LlmUsageTracker usageTracker) {
        this.chatLanguageModel = chatLanguageModel;
        this.usageTracker = usageTracker;
    }

    /**
     * 실제로 프롬프트에 실릴 슬라이스.
     *
     * <p>호출자가 "LLM 이 실제로 본 목록" 을 알아야 한다. 그것을 모른 채 넘긴 목록 전체를 처리 완료로 기록하면, 상한에 잘려 한 글자도 안 들어간 스니펫이
     * "해석했다" 로 남아 다시는 후보에 오르지 않는다. 출처(sourceIndex) 매핑도 이 목록 기준이어야 맞다.
     */
    public List<PopupCrawlSource> limitFor(List<PopupCrawlSource> snippets) {
        if (snippets == null || snippets.isEmpty()) return List.of();
        int limit =
                maxSnippetsPerRequest > 0
                        ? maxSnippetsPerRequest
                        : DEFAULT_MAX_SNIPPETS_PER_REQUEST;
        return snippets.stream().limit(limit).toList();
    }

    /**
     * snippet 묶음을 LLM 에 한 번 넘겨 그 안의 서로 다른 팝업을 <b>모두</b> {@link NormalizedPopup} 목록으로 받는다.
     *
     * <p><b>빈 목록은 "이 글에 팝업이 없다" 는 뜻이며, 실패는 반드시 예외로 나간다.</b> 둘을 같은 값으로 뭉개면 호출자가 실패한 글까지 처리 완료로 확정해
     * 다시는 해석하지 않는다. 일일 한도 소진과 연속 실패는 {@link LlmQuotaExhaustedException}(크롤 중단), 그 외는 {@link
     * LlmCallFailedException}(이 키워드만 건너뜀).
     *
     * <p>각 원소는 후처리 검증(이름 누락·서울 외 강제 0.0)을 통과한 상태이며, confidence 게이트/중복제거는 호출자(Orchestrator)가 담당한다.
     */
    public List<NormalizedPopup> normalizeAll(List<PopupCrawlSource> snippets) {
        if (snippets == null || snippets.isEmpty()) {
            return List.of();
        }
        // 이미 오늘 일일 한도를 맞았으면 호출하지 않는다. 남은 키워드마다 429 를 한 번씩 더 맞는 것을 막는다.
        if (usageTracker.isDailyQuotaExhausted(LlmUsageTracker.Role.CRAWLER)) {
            throw new LlmQuotaExhaustedException("일일 LLM 한도 소진 상태 — 호출 생략");
        }

        List<PopupCrawlSource> limited = limitFor(snippets);
        String prompt = buildPrompt(limited);

        usageTracker.recordAttempt(LlmUsageTracker.Role.CRAWLER);
        Response<AiMessage> response;
        try {
            // generate(String) 대신 메시지 버전을 쓰는 이유: 이쪽만 TokenUsage 를 돌려준다.
            // 토큰 실측이 없으면 스니펫 수·키워드 수를 정할 근거가 계속 추측으로 남는다.
            response = chatLanguageModel.generate(List.of(new UserMessage(prompt)));
        } catch (Exception e) {
            throw handleCallFailure(e);
        }

        recordTokens(response.tokenUsage());

        try {
            JsonNode array = extractArray(parseJsonResponse(response.content().text()));
            List<NormalizedPopup> results = new ArrayList<>();
            for (JsonNode node : array) {
                results.add(applyPostValidations(parseNormalizedPopup(node)));
            }
            usageTracker.recordSuccess(LlmUsageTracker.Role.CRAWLER);
            return results;
        } catch (Exception e) {
            // 모델은 응답했는데 JSON 이 아니었다 — 쿼터 문제와 전혀 다른 원인이므로 따로 센다.
            //
            // 빈 목록을 반환하면 안 된다. 호출자가 "이 글에는 팝업이 없다" 로 읽고 원문을 PROCESSED 로
            // 확정해 버려, 실제로는 팝업이 실려 있던 글이 영영 다시 해석되지 않는다. 예외로 올려
            // RETRYABLE 로 남기고 다음 회차에 재시도하게 한다.
            usageTracker.recordFailure(LlmUsageTracker.Role.CRAWLER, LlmFailureKind.PARSE);
            int streak = usageTracker.recordConsecutiveFailure(LlmUsageTracker.Role.CRAWLER);
            log.warn("[PopupNormalization] 응답 JSON 파싱 실패 (연속 {}회): {}", streak, e.toString());
            if (streak >= MAX_CONSECUTIVE_FAILURES) {
                // 모델이 계속 형식을 어기는 상황. 남은 키워드를 돌아봐야 토큰만 태운다.
                throw new LlmQuotaExhaustedException("연속 JSON 파싱 실패 " + streak + "회");
            }
            throw new LlmCallFailedException(LlmFailureKind.PARSE);
        }
    }

    private void recordTokens(TokenUsage tokens) {
        if (tokens == null) {
            usageTracker.recordResponse(LlmUsageTracker.Role.CRAWLER, null, null);
            return;
        }
        usageTracker.recordResponse(
                LlmUsageTracker.Role.CRAWLER, tokens.inputTokenCount(), tokens.outputTokenCount());
    }

    /**
     * 호출 실패를 분류해 기록하고, 크롤을 멈춰야 하는 경우에만 예외를 밖으로 내보낸다.
     *
     * @return 호출자가 던질 예외. 일일 한도면 {@link LlmQuotaExhaustedException}, 그 외는 이 키워드만 건너뛰게 하는 표식.
     */
    private RuntimeException handleCallFailure(Exception error) {
        LlmFailureKind kind = LlmErrors.classify(error);
        usageTracker.recordFailure(LlmUsageTracker.Role.CRAWLER, kind);
        Optional<Long> retryAfter = LlmErrors.retryAfterSeconds(error);
        String retryAfterText = retryAfter.map(s -> s + "s").orElse("미제공");

        if (kind == LlmFailureKind.RATE_LIMIT_DAY) {
            usageTracker.markDailyQuotaExhausted(
                    LlmUsageTracker.Role.CRAWLER, retryAfter.orElse(null));
            log.error(
                    "[PopupNormalization] QUOTA_EXHAUSTED — 일일 LLM 한도 초과. retry-after={} 원인={}",
                    retryAfterText,
                    error.toString());
            return new LlmQuotaExhaustedException("일일 LLM 한도 초과");
        }

        // 한도 종류를 알 수 없는 429(본문이 빈 경우)나 키 만료·네트워크 장애 같은 지속 실패는
        // 키워드마다 건너뛰기만 하면 400개를 도는 데 수 시간이 걸린다. 연속 실패로 차단한다.
        int streak = usageTracker.recordConsecutiveFailure(LlmUsageTracker.Role.CRAWLER);
        if (streak >= MAX_CONSECUTIVE_FAILURES) {
            log.error(
                    "[PopupNormalization] 연속 실패 {}회({}) — 크롤 중단. 원인={}",
                    streak,
                    kind,
                    error.toString());
            return new LlmQuotaExhaustedException("연속 LLM 실패 " + streak + "회 (" + kind + ")");
        }

        if (kind == LlmFailureKind.RATE_LIMIT_MINUTE) {
            log.warn(
                    "[PopupNormalization] 분당 한도 초과 — 이 키워드 건너뜀. retry-after={} (연속 {}회)",
                    retryAfterText,
                    streak);
        } else {
            log.error(
                    "[PopupNormalization] LLM 호출 실패({}, 연속 {}회): {}",
                    kind,
                    streak,
                    error.toString());
        }
        return new LlmCallFailedException(kind);
    }

    /** 이 키워드만 건너뛰라는 표식. 크롤 전체를 멈추지 않는다. */
    public static class LlmCallFailedException extends RuntimeException {
        private final transient LlmFailureKind kind;

        LlmCallFailedException(LlmFailureKind kind) {
            super("LLM 호출 실패: " + kind);
            this.kind = kind;
        }

        public LlmFailureKind kind() {
            return kind;
        }
    }

    /* =========================== 프롬프트 / 파싱 =========================== */

    private String buildPrompt(List<PopupCrawlSource> snippets) {
        return String.format(PROMPT_TEMPLATE, LocalDate.now(), formatSnippetsForPrompt(snippets));
    }

    /** snippet 을 "1. [출처] 제목 : 요약" 형태로 번호를 매겨 나열 — LLM 이 sourceIndex 로 출처를 지목할 수 있게. */
    private String formatSnippetsForPrompt(List<PopupCrawlSource> snippets) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < snippets.size(); i++) {
            if (i > 0) sb.append('\n');
            sb.append(i + 1).append(". ").append(formatSingleSnippet(snippets.get(i)));
        }
        return sb.toString();
    }

    private String formatSingleSnippet(PopupCrawlSource snippet) {
        return "["
                + snippet.getSourceName()
                + "] "
                + safe(snippet.getTitle())
                + " : "
                + safe(snippet.getDescription());
    }

    /** LLM 응답에서 마크다운 코드펜스를 제거한 후 JSON 파싱. */
    private JsonNode parseJsonResponse(String rawResponse) throws Exception {
        String cleaned = rawResponse.replaceAll("```json", "").replaceAll("```", "").trim();
        return objectMapper.readTree(cleaned);
    }

    /**
     * 응답 루트를 팝업 객체 배열로 정규화. LLM 이 배열을 그대로 주는 게 정상이지만, 가끔 {@code {"popups":[...]}} 로 감싸거나 객체 하나만 주는
     * 경우가 있어 방어적으로 처리한다.
     */
    private JsonNode extractArray(JsonNode root) {
        if (root.isArray()) {
            return root;
        }
        if (root.isObject()) {
            for (String key : List.of("popups", "results", "items", "data", "list")) {
                if (root.path(key).isArray()) {
                    return root.path(key);
                }
            }
            if (root.hasNonNull("name")) {
                ArrayNode wrapped = objectMapper.createArrayNode();
                wrapped.add(root);
                return wrapped;
            }
        }
        return objectMapper.createArrayNode();
    }

    private NormalizedPopup parseNormalizedPopup(JsonNode node) {
        return NormalizedPopup.builder()
                .name(sanitize(node.path("name").asText(""), MAX_NAME_LEN))
                .location(sanitize(node.path("location").asText(""), MAX_LOCATION_LEN))
                .category(node.path("category").asText(DEFAULT_CATEGORY))
                .startDate(normalizeDate(nullableText(node, "startDate")))
                .endDate(normalizeDate(nullableText(node, "endDate")))
                .officialUrl(validateUrl(nullableText(node, "officialUrl")))
                .reservationUrl(validateUrl(nullableText(node, "reservationUrl")))
                .description(sanitize(node.path("description").asText(""), MAX_DESC_LEN))
                .content(sanitize(node.path("content").asText(""), MAX_CONTENT_LEN))
                .confidence(node.path("confidence").asDouble(0.0))
                .sourceIndex(nullableInt(node, "sourceIndex"))
                .error(nullableText(node, "error"))
                .build();
    }

    /* =========================== 후처리 검증 =========================== */

    /**
     * LLM 이 confidence 를 잘못 매겼을 경우를 대비한 안전 점검.
     *
     * <ul>
     *   <li>name 이 비어있으면 강제 0.0
     *   <li>서울 외 지역이면 강제 0.0
     *   <li>시작일이 종료일보다 늦으면 두 날짜를 폐기(추측 보충하지 않음)
     * </ul>
     */
    private NormalizedPopup applyPostValidations(NormalizedPopup result) {
        if (isNameMissing(result)) {
            forceRejection(result, ERROR_EMPTY_NAME);
        }
        if (isLocationOutsideSeoul(result)) {
            forceRejection(result, ERROR_NOT_IN_SEOUL);
        }
        rejectInvertedDateRange(result);
        return result;
    }

    /**
     * 시작일이 종료일보다 늦으면 두 날짜를 모두 버린다.
     *
     * <p>정규화된 날짜는 ISO({@code 2026-05-01}) 라 사전순 비교가 곧 시간순이다. 뒤집힌 구간은 LLM 이 잘못 뽑은 것이므로 어느 쪽도 믿을 수 없다
     * — 한쪽만 살리면 오히려 잘못된 만료 판정을 낳는다. 추측으로 바로잡지 않고 둘 다 null 로 둔다(날짜 없는 팝업으로 처리).
     */
    private void rejectInvertedDateRange(NormalizedPopup result) {
        String start = result.getStartDate();
        String end = result.getEndDate();
        if (start != null && end != null && start.compareTo(end) > 0) {
            log.warn("[PopupNormalization] 시작일이 종료일보다 늦음: {} > {} — 날짜 폐기", start, end);
            result.setStartDate(null);
            result.setEndDate(null);
        }
    }

    private boolean isNameMissing(NormalizedPopup result) {
        return result.getName() == null || result.getName().isBlank();
    }

    private boolean isLocationOutsideSeoul(NormalizedPopup result) {
        return result.getLocation() != null && !result.getLocation().contains(SEOUL_KEYWORD);
    }

    private void forceRejection(NormalizedPopup result, String errorCode) {
        result.setConfidence(0.0);
        if (result.getError() == null) {
            result.setError(errorCode);
        }
    }

    /* =========================== 단순 헬퍼 =========================== */

    private String nullableText(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isNull() || value.isMissingNode()) return null;
        String text = value.asText("");
        return text.isBlank() ? null : text;
    }

    private Integer nullableInt(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.canConvertToInt() ? value.asInt() : null;
    }

    /** {@code YYYY-M-D} 대략 형태만 걸러 두고 실제 유효성은 {@link LocalDate#parse} 로 확정한다. */
    private static final Pattern DATE_SHAPE = Pattern.compile("^\\d{4}-\\d{1,2}-\\d{1,2}$");

    private static final DateTimeFormatter LENIENT_INPUT = DateTimeFormatter.ofPattern("yyyy-M-d");

    /**
     * LLM 이 준 날짜 문자열을 엄격 검증해 ISO({@code 2026-05-01})로 정규화한다. 형식이 어긋나거나 실재하지 않는 날짜({@code
     * 2026-13-45})면 {@code null} 을 돌려준다.
     *
     * <p><b>추측 보충하지 않는다.</b> 모르는 날짜를 오늘·이번달로 채우면 잘못된 만료·캘린더 판정을 낳는다. 없으면 없는 채로 둔다. ISO 로 통일해 두면 이후
     * 문자열 비교(만료·정렬)가 그대로 시간순이 된다.
     */
    private String normalizeDate(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (!DATE_SHAPE.matcher(s).matches()) return null;
        try {
            return LocalDate.parse(s, LENIENT_INPUT).format(DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 공백 없는 http(s) URL 만 통과시킨다. 길이 상한으로 비정상 출력을 막는다. LLM 이 지어낸 값은 형식으로 완전히 거를 수 없으나 명백한 쓰레기는 차단한다.
     */
    private static final Pattern URL_SHAPE = Pattern.compile("^https?://\\S+$");

    private static final int MAX_URL_LEN = 500;

    private String validateUrl(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.length() > MAX_URL_LEN || !URL_SHAPE.matcher(s).matches()) return null;
        return s;
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    /**
     * 크롤링한 텍스트 정제 — HTML 태그 제거 + 길이 상한. 프론트 렌더 escape 와 함께 저장형 XSS 를 2중으로 막고, 비정상적으로 긴 LLM 출력으로부터
     * DB 컬럼을 보호한다.
     */
    private String sanitize(String raw, int maxLen) {
        if (raw == null) return "";
        String stripped = raw.replaceAll("<[^>]*>", "").trim();
        return stripped.length() > maxLen ? stripped.substring(0, maxLen).trim() : stripped;
    }
}
