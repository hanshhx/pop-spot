package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 자연어(AI) 팝업 검색 — 사용자의 검색 의도를 LLM(Groq)이 해석해 '지도에 떠 있는 팝업 중' 맞는 것들의 id 를 고른다.
 *
 * <p>후보군은 지도 마커와 동일한 {@code findVisibleMapMarkers} 라서, 프론트가 반환된 id 로 핀만 필터하면 "검색어에
 * 맞는 핀만" 남는다. 응답은 id 문자열 JSON 배열로 강제하고, 실재하는 후보 id 로만 필터해 환각을 차단한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiSearchService {

    private static final int MAX_CANDIDATES = 400;
    private static final int MAX_RESULTS = 40;

    private final ChatLanguageModel chatLanguageModel;
    private final PopupStoreService popupStoreService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<String> searchPopupIds(String query) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) return List.of();

        List<PopupStore> candidates = popupStoreService.findVisibleMapMarkers();
        if (candidates.isEmpty()) return List.of();
        List<PopupStore> bounded =
                candidates.size() > MAX_CANDIDATES
                        ? candidates.subList(0, MAX_CANDIDATES)
                        : candidates;

        Set<String> validIds =
                bounded.stream().map(p -> String.valueOf(p.getId())).collect(Collectors.toSet());

        log.info("[AiSearch] q='{}' 후보={}", q, bounded.size());
        try {
            String response = chatLanguageModel.generate(buildPrompt(q, bounded));
            return parseIds(response).stream()
                    .filter(validIds::contains)
                    .distinct()
                    .limit(MAX_RESULTS)
                    .toList();
        } catch (Exception e) {
            log.error("[AiSearch] LLM 호출 실패", e);
            throw new IllegalStateException("AI 검색 실패: " + e.getMessage());
        }
    }

    private String buildPrompt(String query, List<PopupStore> popups) {
        StringBuilder sb = new StringBuilder();
        sb.append("너는 서울 팝업스토어 검색 도우미다. 아래 목록에서 사용자 검색 의도에 맞는 팝업의 id 만 고른다.\n");
        sb.append("검색어: \"").append(query).append("\"\n");
        sb.append("규칙: 의미상 관련된 것만 선택(브랜드·카테고리·지역·분위기 고려). 억지로 채우지 말고 없으면 [].\n");
        sb.append("반드시 id 문자열 JSON 배열로만 답하라. 예: [\"12\",\"34\"]. 마크다운·설명·잡담 금지.\n\n");
        sb.append("목록 (id | 이름 | 카테고리 | 지역):\n");
        for (PopupStore p : popups) {
            sb.append(p.getId())
                    .append(" | ")
                    .append(nz(p.getName()))
                    .append(" | ")
                    .append(nz(p.getCategory()))
                    .append(" | ")
                    .append(nz(p.getLocation()))
                    .append("\n");
        }
        return sb.toString();
    }

    private List<String> parseIds(String responseText) {
        try {
            String clean = responseText.replaceAll("```json", "").replaceAll("```", "").trim();
            List<?> raw = objectMapper.readValue(clean, List.class);
            return raw.stream().map(String::valueOf).toList();
        } catch (Exception e) {
            log.warn("[AiSearch] JSON 파싱 실패: {}", e.getMessage());
            return List.of();
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s.replace("\n", " ").replace("|", "/");
    }
}
