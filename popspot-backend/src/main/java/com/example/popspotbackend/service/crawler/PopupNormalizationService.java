package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.service.ai.CrawlerLlm;
import com.example.popspotbackend.service.ai.LlmErrors;
import com.example.popspotbackend.service.ai.LlmFailureKind;
import com.example.popspotbackend.service.ai.LlmQuotaExhaustedException;
import com.example.popspotbackend.service.ai.LlmUsageTracker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.model.output.TokenUsage;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@RequiredArgsConstructor
public class PopupNormalizationService {

    /** 정규화 결과와 실제 응답을 만든 모델. 대장에 설정값이 아니라 이 값을 기록한다. */
    public record NormalizationBatch(
            List<NormalizedPopup> popups, String modelName, boolean local) {}

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

    /** 팝업 날짜는 모두 한국 기준이다. 운영 서버(UTC)에서 하루가 어긋나지 않도록 존을 명시한다. */
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    // v2.22 — 크롤링 텍스트 정제용 길이 상한. HTML 태그 제거와 함께 저장형 XSS 2중 방어 + DB 보호.
    private static final int MAX_NAME_LEN = 120;
    private static final int MAX_LOCATION_LEN = 200;
    private static final int MAX_DESC_LEN = 300;
    private static final int MAX_CONTENT_LEN = 2000;

    private static final String ERROR_EMPTY_NAME = "EMPTY_NAME";

    /** 히라가나·가타카나. 한자는 뺀다 — 한국어 이름에도 정당하게 쓰여 오탐이 된다. */
    private static final Pattern KANA = Pattern.compile("[\\u3040-\\u30ff]");

    private static final Pattern HANGUL = Pattern.compile("[가-힣]");

    /**
     * LLM 이 한글 자리에 잘못 뱉는 가타카나 → 한글.
     *
     * <p><b>실제로 관측된 글자만 담는다.</b> 가타카나 전체를 옮기는 표를 만들면 <b>일본어가 정당하게 들어간 이름</b>까지 건드리고, 근거 없이 넣은 항목이
     * 조용히 오작동한다. 모르는 글자는 그대로 두고 경고만 남기므로, 새 글자가 나오면 로그를 보고 여기 추가하면 된다.
     *
     * <p><b>키가 두 글자인 것이 있다.</b> {@code ニュ} 는 두 글자가 합쳐 한 음절(뉴)이다. 한 글자씩 바꾸면 "니유발란스" 가 되어 오히려 더 틀린다.
     * 그래서 긴 키를 먼저 맞춘다.
     *
     * <p><b>{@code ン} 이나 홀로 남은 작은 가나({@code ァ ィ ゥ ェ ォ ャ ュ ョ})는 넣지 않는다.</b> 앞 음절에 붙는 글자라 한 음절로 대응되지
     * 않는다 — {@code ン} 을 "ㄴ" 으로 바꾸면 "런ㄴ" 이 된다. 이런 것은 그대로 두고 경고를 남긴다.
     */
    private static final Map<String, String> KANA_TO_HANGUL = Map.of("ニュ", "뉴", "ザ", "자", "ス", "스");

    private static final String ERROR_NOT_IN_SEOUL = "NOT_IN_SEOUL";
    private static final String ERROR_NO_DATE = "NO_DATE";

    private static final String PROMPT_TEMPLATE =
            """
            너는 한국 서울에서 열리는 팝업스토어 정보를 정리하는 어시스턴트야.
            아래 번호가 매겨진 검색 결과 snippet 들을 읽고, 그 안에 등장하는 "서로 다른" 서울 팝업스토어를
            모두 찾아 JSON 배열로 출력해.

            오늘 날짜: %s
            검색 결과 snippet (각 줄은 "번호. [출처|글 작성일] 제목 : 요약" 형태):
            %s

            출력 규칙:
            1) 반드시 JSON 배열 한 개만 출력. 마크다운 코드펜스 / 설명문 절대 금지. 예: [ {...}, {...} ]
            2) 배열의 각 원소 = 서로 다른 팝업스토어 1개. 같은 팝업을 두 번 넣지 마. 팝업이 하나도 없으면 빈 배열 [].
            3) 각 원소 필드:
               - name (string, 필수): 팝업 정식 이름. 명확하지 않으면 그 팝업은 배열에서 빼.
                 ※ 한국어 이름은 한글로만 적어. 히라가나·가타카나를 섞지 마.
                   예) "AK 플라ザ"(X) → "AK 플라자"(O),  "ニュ발란ス"(X) → "뉴발란스"(O)
                   원래 이름이 통째로 일본어인 브랜드는 그대로 둬도 된다 — 섞는 것만 금지다.
               - location (string): 서울 내 주소. 모르면 "서울"만.
               - category (string): FASHION / FOOD / CULTURE / CHARACTER / BEAUTY / TECH / ETC 중 하나.
               - startDate (string): YYYY-MM-DD. 모르면 null.
               - endDate (string): YYYY-MM-DD. 모르면 null.
                 ※ 날짜 읽는 법 (한국 글은 연도·월을 자주 생략한다):
                   · 연도가 없으면 그 snippet 의 "글 작성일" 을 기준으로 채운다.
                     예) 작성일 2026-07-18, 검색 요약 "7월 22일 ~ 8월 3일" → 2026-07-22 / 2026-08-03
                   · 작성일보다 앞선 달이 나오면 다음 해로 넘긴다.
                     예) 작성일 2026-12-20, 검색 요약 "1월 5일 오픈" → 2027-01-05
                   · 종료일에 월이 생략되면 시작일의 월을 이어받는다.
                     예) "7월 8일부터 25일까지" → 2026-07-08 / 2026-07-25
                   · 시작일에 월이 생략되면 종료일의 월을 쓴다.
                     예) "24일부터 5월 6일까지" → 2026-04-24 / 2026-05-06 (월이 넘어가면 한 달 앞)
                   · "5월 24일부터 이틀 동안" 처럼 기간만 있으면 계산해서 종료일을 만든다 → 05-24 / 05-25
                   · "7월 중", "여름 시즌" 처럼 특정 날짜가 없으면 그 필드만 null (지어내지 마).
                   · 이미 끝난 행사를 회고하는 글이어도 적힌 날짜는 그대로 넣는다 — 종료 판정은 우리가 한다.
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

    /**
     * 크롤러 LLM 선택기. 로컬 Ollama(PC 켜짐) 우선, 아니면 Groq. 모델 격리(크롤러 전용 모델)와 로컬/클라우드 전환을 {@link CrawlerLlm}
     * 이 캡슐화하므로, 여기서는 {@code select()} 로 이번 호출에 쓸 모델만 받는다.
     */
    private final CrawlerLlm crawlerLlm;

    private final LlmUsageTracker usageTracker;
    private final ObjectMapper objectMapper = new ObjectMapper();

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
        return normalizeBatch(snippets).popups();
    }

    /** 실제 선택 모델까지 돌려주는 크롤러용 진입점. 로컬 호출 자체가 실패하면 캐시를 폐기하고 Groq 로 한 번만 대체한다. */
    public NormalizationBatch normalizeBatch(List<PopupCrawlSource> snippets) {
        if (snippets == null || snippets.isEmpty()) {
            return new NormalizationBatch(List.of(), "none", false);
        }
        // 로컬 Ollama(PC 켜짐) 우선, 아니면 Groq fallback. 헬스체크는 CrawlerLlm 안에서 캐시된다.
        CrawlerLlm.Selection selection = crawlerLlm.select();

        // 일일 한도 차단은 클라우드(Groq)에만 적용한다. 로컬 Ollama 는 쿼터가 없으므로, Groq 가 오전에
        // 429 로 막혀도 PC 를 켜면 로컬로 계속 수집된다. 이 검사를 모델 선택보다 앞에 두면 — Groq 가 막힌
        // 바로 그 순간, 로컬이 가장 필요한데 — 로컬의 무제한 이점이 통째로 막힌다(실제 버그였다).
        if (!selection.local()
                && usageTracker.isDailyQuotaExhausted(LlmUsageTracker.Role.CRAWLER)) {
            throw new LlmQuotaExhaustedException("Groq 일일 한도 소진 — 로컬 Ollama(PC)를 켜면 계속 수집됩니다");
        }

        List<PopupCrawlSource> limited = limitFor(snippets);
        String prompt = buildPrompt(limited);

        log.info(
                "[PopupNormalization] {} 모델로 정규화 — 스니펫 {}개",
                selection.local()
                        ? "로컬 Ollama(" + selection.modelName() + ")"
                        : "Groq(" + selection.modelName() + ")",
                limited.size());
        Response<AiMessage> response;
        try {
            response = invoke(selection, prompt);
        } catch (Exception e) {
            if (!selection.local()) {
                throw handleCallFailure(e, selection.modelName());
            }

            LlmFailureKind localFailure = LlmErrors.classify(e);
            usageTracker.recordFailure(LlmUsageTracker.Role.CRAWLER, localFailure);
            crawlerLlm.markLocalUnavailable();
            CrawlerLlm.Selection cloud = crawlerLlm.cloudSelection();
            if (usageTracker.isDailyQuotaExhausted(LlmUsageTracker.Role.CRAWLER)) {
                throw new LlmQuotaExhaustedException(
                        "로컬 LLM 실패 후 Groq 일일 한도도 소진됨: " + selection.modelName());
            }
            log.warn(
                    "[PopupNormalization] 로컬 모델 {} 호출 실패({}) — Groq {} 로 1회 fallback",
                    selection.modelName(),
                    localFailure,
                    cloud.modelName());
            selection = cloud;
            try {
                response = invoke(selection, prompt);
            } catch (Exception cloudError) {
                throw handleCallFailure(cloudError, selection.modelName());
            }
        }

        recordTokens(response.tokenUsage());

        try {
            JsonNode array = extractArray(parseJsonResponse(response.content().text()));
            List<NormalizedPopup> results = new ArrayList<>();
            for (JsonNode node : array) {
                NormalizedPopup popup = applyPostValidations(parseNormalizedPopup(node));
                rejectUnsupportedUrls(popup, limited);
                results.add(popup);
            }
            usageTracker.recordSuccess(LlmUsageTracker.Role.CRAWLER);
            logDateExtraction(results, limited);
            return new NormalizationBatch(results, selection.modelName(), selection.local());
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
            throw new LlmCallFailedException(LlmFailureKind.PARSE, selection.modelName());
        }
    }

    private Response<AiMessage> invoke(CrawlerLlm.Selection selection, String prompt) {
        usageTracker.recordAttempt(LlmUsageTracker.Role.CRAWLER);
        // generate(String) 대신 메시지 버전을 쓰는 이유: 이쪽만 TokenUsage 를 돌려준다.
        // 토큰 실측이 없으면 스니펫 수·키워드 수를 정할 근거가 계속 추측으로 남는다.
        return selection.model().generate(List.of(new UserMessage(prompt)));
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
    private RuntimeException handleCallFailure(Exception error, String modelName) {
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
        return new LlmCallFailedException(kind, modelName);
    }

    /** 이 키워드만 건너뛰라는 표식. 크롤 전체를 멈추지 않는다. */
    public static class LlmCallFailedException extends RuntimeException {
        private final transient LlmFailureKind kind;
        private final String modelName;

        LlmCallFailedException(LlmFailureKind kind, String modelName) {
            super("LLM 호출 실패: " + kind);
            this.kind = kind;
            this.modelName = modelName;
        }

        public LlmFailureKind kind() {
            return kind;
        }

        public String modelName() {
            return modelName;
        }
    }

    /* =========================== 프롬프트 / 파싱 =========================== */

    /**
     * 스니펫 텍스트에 날짜처럼 보이는 표현이 있는가.
     *
     * <p>느슨하게 잡는다 — 여기서 놓치면 "검색 요약에 날짜가 없었다" 로 잘못 집계돼 실제로는 프롬프트 문제인데도 외부 자료가 부족한 것으로 오진하게 된다. 과하게
     * 잡히는 쪽이 안전하다.
     */
    private static final Pattern DATE_HINT =
            Pattern.compile(
                    "\\d{1,2}\\s*월\\s*\\d{1,2}\\s*일" // 7월 22일
                            + "|\\d{4}\\s*[.\\-/년]\\s*\\d{1,2}" // 2026.07 / 2026년 7
                            + "|\\d{1,2}\\s*[./]\\s*\\d{1,2}\\s*[~\\-]" // 7.22~
                            + "|\\d{1,2}\\s*일\\s*(부터|까지)" // 22일부터
                            + "|\\d{1,2}\\s*월\\s*(중|말|초)"); // 7월 중

    /**
     * 날짜 추출 성적을 회차마다 남긴다 — <b>다음에 무엇을 고쳐야 하는지</b> 를 숫자로 답하기 위한 것이다.
     *
     * <p>날짜가 안 나온 팝업을 둘로 나눈다.
     *
     * <ul>
     *   <li><b>근거 스니펫에 날짜 표현이 있었는데 못 뽑음</b> — 프롬프트·모델 문제. 더 손볼 여지가 있다.
     *   <li><b>스니펫에 아예 없었음</b> — 검색 요약문의 한계. 추측하거나 원문을 추가 수집하지 않고 날짜 미확인으로 처리한다.
     * </ul>
     *
     * <p>합계만 세면 이 둘을 구분할 수 없어 "날짜가 부족하다" 는 사실만 남고 대책은 계속 추측이 된다. v2.45 에서 날짜 없는 팝업을 버리기 시작했으므로, 버리는
     * 양이 어느 쪽 원인인지 아는 것이 중요하다.
     *
     * <p>sourceIndex 는 프롬프트 기준 1-based 다. 범위를 벗어나거나 없으면 판정에서 뺀다 — 근거를 모르는 채로 어느 한쪽에 넣으면 그 수치가 오히려
     * 오판을 만든다.
     */
    private void logDateExtraction(List<NormalizedPopup> results, List<PopupCrawlSource> snippets) {
        if (results.isEmpty()) return;

        int extracted = 0;
        int missedWithHint = 0;
        int missedNoHint = 0;
        int unknownSource = 0;

        for (NormalizedPopup p : results) {
            if (!isBlank(p.getStartDate()) || !isBlank(p.getEndDate())) {
                extracted++;
                continue;
            }
            Integer idx = p.getSourceIndex();
            if (idx == null || idx < 1 || idx > snippets.size()) {
                unknownSource++;
                continue;
            }
            PopupCrawlSource src = snippets.get(idx - 1);
            String text = safe(src.getTitle()) + " " + safe(src.getDescription());
            if (DATE_HINT.matcher(text).find()) missedWithHint++;
            else missedNoHint++;
        }

        log.info(
                "[DateStats] 팝업 {}개 — 추출 {} / 미추출 {} (스니펫에 날짜 있었음 {} = 추출실패, 없었음 {}, 출처불명 {})",
                results.size(),
                extracted,
                results.size() - extracted,
                missedWithHint,
                missedNoHint,
                unknownSource);
    }

    private String buildPrompt(List<PopupCrawlSource> snippets) {
        // "오늘" 은 반드시 KST 다. LocalDate.now() 는 JVM 기본 시간대를 따르는데 운영 서버가 UTC 라,
        // 한국 새벽(00~09시) 크롤에서는 하루 전 날짜가 프롬프트에 실린다. 그 값으로 LLM 이 연도·월을
        // 보충하므로 팝업 기간이 통째로 하루씩 밀린다. 프론트에서도 같은 원인의 버그를 v2.43 에 고쳤다.
        return String.format(
                PROMPT_TEMPLATE, LocalDate.now(SEOUL), formatSnippetsForPrompt(snippets));
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

    /**
     * 한 줄 형태 — {@code [출처|작성일] 제목 : 요약}.
     *
     * <p>v2.46 — <b>작성일을 넣는다.</b> 한국 블로그는 "7월 22일부터 8월 3일까지" 처럼 연도를 안 쓰는 일이 흔한데, 그전까지 LLM 에게는 오늘
     * 날짜만 줬다. 오늘이 8월이면 "7월 22일" 이 지난달인지 작년인지 알 수 없어 안전하게 null 을 내놓는다. <b>글 작성일이 그 답을 거의 확정해 준다</b>
     * — 7월 18일에 쓴 글의 "7월 22일" 은 그 해 7월이다.
     *
     * <p>이 값은 원래부터 수집하고 있었는데({@code NaverPopupCrawler} / {@code KakaoPopupCrawler} 가 {@code
     * postdate} · {@code pubDate} · {@code datetime} 을 채운다) 읽는 곳이 한 군데도 없었다. 토큰은 줄당 11자만 늘어난다.
     */
    private String formatSingleSnippet(PopupCrawlSource snippet) {
        String posted = normalizePostDate(snippet.getPostDate());
        return "["
                + snippet.getSourceName()
                + (posted == null ? "" : "|" + posted)
                + "] "
                + safe(snippet.getTitle())
                + " : "
                + safe(snippet.getDescription());
    }

    /** 네이버 블로그 {@code postdate}(YYYYMMDD) 8자리. */
    private static final Pattern POST_DATE_COMPACT = Pattern.compile("^(\\d{4})(\\d{2})(\\d{2})$");

    /** 카카오 {@code datetime}(ISO8601) · 그 밖에 앞머리가 YYYY-MM-DD 인 형태. */
    private static final Pattern POST_DATE_ISO_HEAD =
            Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})");

    /** 네이버 뉴스 {@code pubDate}(RFC822) — 예: {@code Fri, 18 Jul 2026 10:00:00 +0900}. */
    private static final Pattern POST_DATE_RFC822 =
            Pattern.compile("(\\d{1,2})\\s+([A-Za-z]{3})\\s+(\\d{4})");

    private static final List<String> RFC822_MONTHS =
            List.of(
                    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov",
                    "dec");

    /**
     * 채널마다 다른 작성일 표기를 {@code YYYY-MM-DD} 로 통일한다. 못 읽으면 null — 프롬프트에서 그냥 빠진다.
     *
     * <p>세 형태를 받는 이유는 채널이 셋이기 때문이다: 네이버 블로그는 {@code 20260718}, 네이버 뉴스는 RFC822, 카카오는 ISO8601 로 준다.
     * 하나만 처리하면 나머지 두 채널의 글은 작성일 없이 나가 원래 문제가 그대로 남는다.
     */
    String normalizePostDate(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty()) return null;

        Matcher iso = POST_DATE_ISO_HEAD.matcher(s);
        if (iso.find()) return iso.group(1) + "-" + iso.group(2) + "-" + iso.group(3);

        Matcher compact = POST_DATE_COMPACT.matcher(s);
        if (compact.matches()) {
            return compact.group(1) + "-" + compact.group(2) + "-" + compact.group(3);
        }

        Matcher rfc = POST_DATE_RFC822.matcher(s);
        if (rfc.find()) {
            int month = RFC822_MONTHS.indexOf(rfc.group(2).toLowerCase()) + 1;
            if (month > 0) {
                return String.format(
                        "%s-%02d-%02d", rfc.group(3), month, Integer.parseInt(rfc.group(1)));
            }
        }
        return null;
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
     *   <li>v2.45 — 날짜가 하나도 없으면 강제 0.0
     * </ul>
     *
     * <p>날짜 검증이 {@link #rejectInvertedDateRange} <b>뒤에</b> 오는 것은 순서가 결과를 바꾸기 때문이다 — 역전 구간은 두 날짜를 모두
     * null 로 만들므로, 그 앞에서 검사하면 "날짜가 있는데 통과" 로 잘못 판정된다.
     */
    private NormalizedPopup applyPostValidations(NormalizedPopup result) {
        if (isNameMissing(result)) {
            forceRejection(result, ERROR_EMPTY_NAME);
        }
        fixKanaInKoreanName(result);
        if (isLocationOutsideSeoul(result)) {
            forceRejection(result, ERROR_NOT_IN_SEOUL);
        }
        rejectInvertedDateRange(result);
        if (isDateMissing(result)) {
            forceRejection(result, ERROR_NO_DATE);
        }
        return result;
    }

    /**
     * 시작일이 종료일보다 늦으면 두 날짜를 모두 버린다.
     *
     * <p>정규화된 날짜는 ISO({@code 2026-05-01}) 라 사전순 비교가 곧 시간순이다. 뒤집힌 구간은 LLM 이 잘못 뽑은 것이므로 어느 쪽도 믿을 수 없다
     * — 한쪽만 살리면 오히려 잘못된 만료 판정을 낳는다. 추측으로 바로잡지 않고 둘 다 null 로 둔다(날짜 없는 팝업으로 처리).
     */
    /**
     * 한글 이름에 섞여 들어온 <b>가나 한두 글자</b>를 한글로 되돌린다.
     *
     * <p><b>왜 생기나.</b> LLM 이 한글로 적어야 할 자리에 음이 비슷한 가타카나를 뱉는다. 2026-08-05 실측 — 1,012건 중 3건이었다.
     *
     * <pre>
     *   ニュ발란ス 런유어웨이 10k        → 뉴발란스 …
     *   AK 플라ザ 귀멸의 칼날 팝업스토어  → AK 플라자 …
     * </pre>
     *
     * <p><b>왜 버리지 않고 고치나.</b> 이름 한 글자 때문에 팝업을 통째로 버리면 손해가 더 크다. 게다가 이 이름은 <b>메타 설명에 그대로 실려</b> 검색
     * 결과에 나간다 — 거기 "플라ザ" 가 찍히면 사람이 눌러 볼 이유가 줄어든다.
     *
     * <p><b>왜 표 하나로 끝내나.</b> 가타카나 전체를 한글로 옮기는 일반 변환은 표가 백 줄이 넘고, 정작 일본어가 <b>정당하게</b> 들어간 이름(일본
     * 브랜드)까지 건드린다. 그래서 <b>한글이 이미 섞여 있는 이름</b>에서, 실제로 관측된 오염 글자만 되돌린다. 모르는 글자는 손대지 않고 로그만 남긴다 — 조용히
     * 지우면 이름이 더 망가진다.
     */
    private void fixKanaInKoreanName(NormalizedPopup result) {
        String name = result.getName();
        if (name == null || !KANA.matcher(name).find()) return;
        // 한글이 없으면 일본어 이름일 수 있다. 그건 정상이므로 건드리지 않는다.
        if (!HANGUL.matcher(name).find()) return;

        StringBuilder sb = new StringBuilder(name.length());
        boolean unknown = false;
        for (int i = 0; i < name.length(); ) {
            // 두 글자 키를 먼저 맞춘다 — ニュ 를 ニ + ュ 로 나누면 "니유" 가 되어 더 틀린다.
            String two = i + 1 < name.length() ? name.substring(i, i + 2) : null;
            String mapped = two != null ? KANA_TO_HANGUL.get(two) : null;
            if (mapped != null) {
                sb.append(mapped);
                i += 2;
                continue;
            }
            String one = name.substring(i, i + 1);
            mapped = KANA_TO_HANGUL.get(one);
            if (mapped != null) {
                sb.append(mapped);
            } else {
                sb.append(one);
                if (isKana(name.charAt(i))) unknown = true;
            }
            i++;
        }
        String fixed = sb.toString();
        if (!fixed.equals(name)) {
            log.info("[PopupNormalization] 이름의 가나를 한글로 되돌림: '{}' → '{}'", name, fixed);
            result.setName(fixed);
        }
        if (unknown) {
            log.warn(
                    "[PopupNormalization] 표에 없는 가나가 이름에 남아 있다(그대로 둠): '{}'"
                            + " — 자주 보이면 KANA_TO_HANGUL 에 추가할 것",
                    fixed);
        }
    }

    private static boolean isKana(char c) {
        return (c >= '぀' && c <= 'ゟ') || (c >= '゠' && c <= 'ヿ');
    }

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

    /**
     * 시작일·종료일이 <b>둘 다</b> 없는가.
     *
     * <p>v2.45 — 날짜 없는 팝업을 저장하지 않는다. 프런트 실측 기준 수집분 1,355건 중 864건(64%)이 종료일이 없었고 그중 568건은 시작일마저 없었다.
     * 검색 요약이 "…성수동에서 열렸다" 처럼 과거형인 것도 섞여 있다 — 이미 지난 행사를 적은 글에서 뽑아낸 것이다.
     *
     * <p>날짜가 없으면 열려 있는지 끝났는지 판정할 방법이 없어, 화면에서는 어느 쪽으로든 추측해야 한다. 그 추측을 잘못하면 <b>닫힌 곳으로 사람을 보내게
     * 된다.</b> 애초에 저장하지 않는 편이 낫다.
     *
     * <p>한쪽만 있으면 통과시킨다 — 시작일만 있으면 상시 운영이거나 종료일만 못 뽑은 경우이고, 적어도 "문을 열었다" 는 근거는 있다. 종료일만 있어도 언제까지인지는
     * 알 수 있다.
     */
    private boolean isDateMissing(NormalizedPopup result) {
        return isBlank(result.getStartDate()) && isBlank(result.getEndDate());
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
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

    /**
     * 날짜 파싱기 — <b>반드시 STRICT</b>. 기본(SMART) 모드는 "2026-02-30"(없는 날)을 조용히 2026-02-28 로 조정해 잘못된 날짜를
     * 그럴듯한 값으로 둔갑시킨다. 우리는 이런 값을 거부(null)해야 하므로 STRICT 로 실제 존재하는 날짜만 통과시킨다. {@code uuuu} 는 era 없이
     * 연도를 받기 위한 것(STRICT + {@code yyyy} 는 era 를 요구해 실패한다).
     */
    private static final DateTimeFormatter STRICT_INPUT =
            DateTimeFormatter.ofPattern("uuuu-M-d").withResolverStyle(ResolverStyle.STRICT);

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
            return LocalDate.parse(s, STRICT_INPUT).format(DateTimeFormatter.ISO_LOCAL_DATE);
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

    private static final Pattern URL_TOKEN = Pattern.compile("https?://[^\\s<>\\\"']+");

    /**
     * officialUrl/reservationUrl 이 해당 팝업이 지목한 스니펫 원문에 정확한 URL 토큰으로 없으면 폐기한다.
     *
     * <p>프롬프트에 "지어내지 마" 라고 지시해도 형식만 맞는 가짜 URL 이 나올 수 있다(형식 검증만으로는 못 거른다). 프롬프트에 실제로 들어간 스니펫 텍스트에 그
     * URL 이 있는지 대조해, 없으면 환각으로 보고 null 처리한다. 다른 팝업의 스니펫 URL과 출처 글 자체의 링크는 근거로 인정하지 않는다.
     */
    void rejectUnsupportedUrls(NormalizedPopup popup, List<PopupCrawlSource> snippets) {
        Set<String> supported = supportedUrls(popup.getSourceIndex(), snippets);
        if (popup.getOfficialUrl() != null && !supported.contains(popup.getOfficialUrl())) {
            log.warn(
                    "[PopupNormalization] officialUrl 이 스니펫에 없음(환각 의심) — 폐기: {}",
                    popup.getOfficialUrl());
            popup.setOfficialUrl(null);
        }
        if (popup.getReservationUrl() != null && !supported.contains(popup.getReservationUrl())) {
            log.warn(
                    "[PopupNormalization] reservationUrl 이 스니펫에 없음(환각 의심) — 폐기: {}",
                    popup.getReservationUrl());
            popup.setReservationUrl(null);
        }
    }

    private Set<String> supportedUrls(Integer sourceIndex, List<PopupCrawlSource> snippets) {
        if (sourceIndex == null || sourceIndex < 1 || sourceIndex > snippets.size()) {
            return Set.of();
        }
        PopupCrawlSource source = snippets.get(sourceIndex - 1);
        String evidence = safe(source.getTitle()) + " " + safe(source.getDescription());
        Set<String> urls = new LinkedHashSet<>();
        Matcher matcher = URL_TOKEN.matcher(evidence);
        while (matcher.find()) {
            String token = trimUrlPunctuation(matcher.group());
            if (validateUrl(token) != null) urls.add(token);
        }
        return urls;
    }

    private String trimUrlPunctuation(String value) {
        String result = value;
        while (!result.isEmpty()
                && ".,;:!?)]}〉》」』。 ，".indexOf(result.charAt(result.length() - 1)) >= 0) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
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
