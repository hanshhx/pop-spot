package com.example.popspotbackend.service.crawler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 검색 API 결과(snippet 들)를 LLM 에 넘겨 구조화된 {@link NormalizedPopup} 으로 정규화.
 *
 * <p>동일 팝업 후보에 대해 여러 출처 snippet 을 한 번에 넘겨 정확도를 끌어올린다. confidence 점수는 LLM 이 직접 매긴다 (필드 완성도/날짜 명확성/장소
 * 명확성).
 *
 * <p>토큰 절약을 위해 snippet 은 최대 {@link #MAX_SNIPPETS_PER_REQUEST} 개까지만 사용.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupNormalizationService {

    private static final int MAX_SNIPPETS_PER_REQUEST = 8;
    private static final String DEFAULT_CATEGORY = "ETC";
    private static final String SEOUL_KEYWORD = "서울";

    private static final String ERROR_EMPTY_SNIPPETS = "EMPTY_SNIPPETS";
    private static final String ERROR_EMPTY_NAME = "EMPTY_NAME";
    private static final String ERROR_NOT_IN_SEOUL = "NOT_IN_SEOUL";
    private static final String ERROR_LLM_PREFIX = "LLM_ERROR: ";

    private static final String PROMPT_TEMPLATE =
            """
            너는 한국 서울에서 열리는 팝업스토어 정보를 정리하는 어시스턴트야.
            아래 검색 결과 snippet 들을 보고 동일한 팝업스토어 1개에 대한 구조화된 JSON 1개를 출력해.

            오늘 날짜: %s
            검색 결과 snippet (각 줄은 [출처] 제목 : 요약 형태):
            %s

            출력 규칙:
            1) 반드시 JSON 한 개만. 마크다운 코드펜스 / 설명문 절대 금지.
            2) 필드:
               - name (string, 필수): 팝업 정식 이름. 검색 결과에 명확하지 않으면 빈 문자열.
               - location (string): 서울 내 주소. 모르면 "서울"만.
               - category (string): FASHION / FOOD / CULTURE / CHARACTER / BEAUTY / TECH / ETC 중 하나.
               - startDate (string): YYYY-MM-DD. 모르면 null.
               - endDate (string): YYYY-MM-DD. 모르면 null.
               - description (string): 50자 내외 한 줄 설명.
               - content (string): 200자 내외 상세 설명.
               - confidence (number 0.0 ~ 1.0): 아래 기준으로 점수 매김:
                 * name 명확 +0.3, location 구 단위 이상 명확 +0.2, startDate/endDate 둘 다 명확 +0.3,
                 * 출처 2개 이상에서 같은 정보 +0.1, 카테고리 명확 +0.1
               - error (string|null): 정리 불가능하면 사유, 가능하면 null
            3) 검색 결과가 팝업스토어와 무관하거나 너무 모호하면 error 에 사유 적고 confidence 0.0.
            4) 서울이 아니면 confidence 0.0.
            5) 개인정보 보호 — 다음은 description/content 에 절대 포함하지 마:
               운영자 휴대폰 번호, 운영자 이메일, 인스타 DM 안내 같은 개인 연락처,
               블로그 작성자 닉네임/실명, 후기를 쓴 개인의 인적사항.
               필요하면 "공식 SNS 참고" 같은 일반 표현으로 대체.
            6) description/content 는 검색 스니펫의 문장을 그대로 베끼지 말고 너의 표현으로 요약해.

            예시 출력:
            {"name":"○○ 팝업스토어","location":"서울 성동구 성수동","category":"FASHION","startDate":"2026-05-01","endDate":"2026-05-31","description":"○○ 브랜드 신상 컬렉션 팝업","content":"...","confidence":0.85,"error":null}
            """;

    private final ChatLanguageModel chatLanguageModel;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** snippet 묶음을 LLM 에 넘겨 NormalizedPopup 1개를 받는다. */
    public NormalizedPopup normalize(List<PopupCrawlSource> snippets) {
        if (snippets == null || snippets.isEmpty()) {
            return buildErrorResult(ERROR_EMPTY_SNIPPETS);
        }

        String prompt = buildPrompt(snippets);

        try {
            String response = chatLanguageModel.generate(prompt);
            JsonNode jsonNode = parseJsonResponse(response);
            NormalizedPopup result = parseNormalizedPopup(jsonNode);
            return applyPostValidations(result);
        } catch (Exception e) {
            log.error("[PopupNormalization] LLM 호출 실패: {}", e.toString());
            return buildErrorResult(ERROR_LLM_PREFIX + e.getMessage());
        }
    }

    /* =========================== 프롬프트 / 파싱 =========================== */

    private String buildPrompt(List<PopupCrawlSource> snippets) {
        String snippetText = formatSnippetsForPrompt(snippets);
        return String.format(PROMPT_TEMPLATE, LocalDate.now(), snippetText);
    }

    private String formatSnippetsForPrompt(List<PopupCrawlSource> snippets) {
        return snippets.stream()
                .limit(MAX_SNIPPETS_PER_REQUEST)
                .map(this::formatSingleSnippet)
                .collect(Collectors.joining("\n"));
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

    private NormalizedPopup parseNormalizedPopup(JsonNode node) {
        return NormalizedPopup.builder()
                .name(node.path("name").asText(""))
                .location(node.path("location").asText(""))
                .category(node.path("category").asText(DEFAULT_CATEGORY))
                .startDate(nullableText(node, "startDate"))
                .endDate(nullableText(node, "endDate"))
                .description(node.path("description").asText(""))
                .content(node.path("content").asText(""))
                .confidence(node.path("confidence").asDouble(0.0))
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

    private NormalizedPopup buildErrorResult(String errorCode) {
        return NormalizedPopup.builder().confidence(0.0).error(errorCode).build();
    }

    private String nullableText(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isNull() || value.isMissingNode()) return null;
        String text = value.asText("");
        return text.isBlank() ? null : text;
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
