package com.example.popspotbackend.service.crawler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 검색 API 결과(snippet 들) → Gemini → 구조화된 NormalizedPopup.
 *
 * 동일 팝업에 대해 여러 출처 snippet 을 한 번에 넣어 정확도를 올림.
 * confidence 점수는 Gemini 가 직접 매김 (필드 완성도/날짜 명확성/장소 명확성).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupNormalizationService {

    private final ChatLanguageModel chatLanguageModel;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String PROMPT_TEMPLATE = """
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

    /**
     * snippet 묶음을 Gemini 에 던져 NormalizedPopup 1개를 받음.
     */
    public NormalizedPopup normalize(List<PopupCrawlSource> snippets) {
        if (snippets == null || snippets.isEmpty()) {
            return NormalizedPopup.builder()
                    .confidence(0.0)
                    .error("EMPTY_SNIPPETS")
                    .build();
        }

        String snippetText = snippets.stream()
                .limit(8)   // 토큰 절약
                .map(s -> "[" + s.getSourceName() + "] " + safe(s.getTitle()) + " : " + safe(s.getDescription()))
                .collect(Collectors.joining("\n"));

        String prompt = String.format(PROMPT_TEMPLATE, LocalDate.now(), snippetText);

        try {
            String response = chatLanguageModel.generate(prompt);
            String clean = response.replaceAll("```json", "")
                    .replaceAll("```", "")
                    .trim();
            JsonNode node = objectMapper.readTree(clean);

            NormalizedPopup result = NormalizedPopup.builder()
                    .name(node.path("name").asText(""))
                    .location(node.path("location").asText(""))
                    .category(node.path("category").asText("ETC"))
                    .startDate(nullableText(node, "startDate"))
                    .endDate(nullableText(node, "endDate"))
                    .description(node.path("description").asText(""))
                    .content(node.path("content").asText(""))
                    .confidence(node.path("confidence").asDouble(0.0))
                    .error(nullableText(node, "error"))
                    .build();

            // 안전 점검: name 비었으면 강제 0
            if (result.getName() == null || result.getName().isBlank()) {
                result.setConfidence(0.0);
                if (result.getError() == null) result.setError("EMPTY_NAME");
            }
            // 서울 외 지역이면 0
            if (result.getLocation() != null && !result.getLocation().contains("서울")) {
                result.setConfidence(0.0);
                if (result.getError() == null) result.setError("NOT_IN_SEOUL");
            }
            return result;

        } catch (Exception e) {
            log.error("[PopupNormalizationService] Gemini 호출 실패: {}", e.toString());
            return NormalizedPopup.builder()
                    .confidence(0.0)
                    .error("GEMINI_ERROR: " + e.getMessage())
                    .build();
        }
    }

    private String nullableText(JsonNode node, String field) {
        JsonNode v = node.path(field);
        if (v.isNull() || v.isMissingNode()) return null;
        String s = v.asText("");
        return s.isBlank() ? null : s;
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
