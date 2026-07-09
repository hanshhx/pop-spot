package com.example.popspotbackend.service.crawler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import dev.langchain4j.model.chat.ChatLanguageModel;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 검색 API 결과(snippet 들)를 LLM 에 넘겨 구조화된 {@link NormalizedPopup} 목록으로 정규화.
 *
 * <p>v2.33 — 한 번의 LLM 호출로 snippet 묶음 안의 <b>서로 다른 팝업을 전부</b> 추출한다(JSON 배열). 이전엔 키워드당 팝업 1개만 뽑아 수집량이
 * 병목이었다 — 같은 API 로 이미 가져온 snippet 을 더 깊게 활용해 추가 크롤/쿼터 없이 수확만 끌어올린다. confidence 점수는 팝업마다 LLM 이 직접
 * 매기고, 0.8 게이트/중복제거/PII 규칙은 그대로 유지된다.
 *
 * <p>토큰과 Groq RPM 을 아끼기 위해 snippet 은 최대 {@link #MAX_SNIPPETS_PER_REQUEST} 개까지만 프롬프트에 넣는다(호출 수는 키워드당
 * 1회로 고정).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupNormalizationService {

    // v2.33 — 8 → 40. API 가 이미 가져온 snippet(키워드당 최대 120개) 중 앞 8개만 보던 병목 해소.
    // Groq context/RPM 여유 안에서 다건 추출이 가능한 상한.
    private static final int MAX_SNIPPETS_PER_REQUEST = 40;
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
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * snippet 묶음을 LLM 에 한 번 넘겨 그 안의 서로 다른 팝업을 <b>모두</b> {@link NormalizedPopup} 목록으로 받는다.
     *
     * <p>파싱/호출 실패 시 빈 목록을 반환(예외 전파 없음). 각 원소는 후처리 검증(이름 누락·서울 외 강제 0.0)을 통과한 상태이며, confidence
     * 게이트/중복제거는 호출자(Orchestrator)가 담당한다.
     */
    public List<NormalizedPopup> normalizeAll(List<PopupCrawlSource> snippets) {
        if (snippets == null || snippets.isEmpty()) {
            return List.of();
        }

        List<PopupCrawlSource> limited = snippets.stream().limit(MAX_SNIPPETS_PER_REQUEST).toList();
        String prompt = buildPrompt(limited);

        try {
            String response = chatLanguageModel.generate(prompt);
            JsonNode array = extractArray(parseJsonResponse(response));

            List<NormalizedPopup> results = new ArrayList<>();
            for (JsonNode node : array) {
                results.add(applyPostValidations(parseNormalizedPopup(node)));
            }
            return results;
        } catch (Exception e) {
            log.error("[PopupNormalization] LLM 호출/파싱 실패: {}", e.toString());
            return List.of();
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
                .startDate(nullableText(node, "startDate"))
                .endDate(nullableText(node, "endDate"))
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
     * </ul>
     */
    private NormalizedPopup applyPostValidations(NormalizedPopup result) {
        if (isNameMissing(result)) {
            forceRejection(result, ERROR_EMPTY_NAME);
        }
        if (isLocationOutsideSeoul(result)) {
            forceRejection(result, ERROR_NOT_IN_SEOUL);
        }
        return result;
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
