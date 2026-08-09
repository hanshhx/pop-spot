package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.ai.UserLlmInvoker;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 자연어(AI) 팝업 검색 — 사용자의 검색 의도를 LLM(Groq)이 해석해 '지도에 떠 있는 팝업 중' 맞는 것들을 고른다.
 *
 * <p>후보군은 지도 마커와 동일한 {@code findVisibleMapMarkers}. LLM 에는 id 만 JSON 배열로 답하게 강제하고, 실재하는 후보 id 로만
 * 필터해 환각을 차단한 뒤, 프론트가 지도 핀 필터(맵) / 결과 목록(모달) 양쪽에 쓰도록 id·이름·위치를 함께 돌려준다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiSearchService {

    /**
     * 검색어에 걸린 후보를 최대 몇 개까지 넘길지.
     *
     * <p>후보 하나가 대략 26 토큰이다(운영에서 400개 = 10,332 토큰이었다). Groq 한도가 분당 8,000 이므로 3,000 토큰쯤에서 멈춘다 — 프롬프트
     * 머리말과 응답 몫을 남겨야 한다.
     */
    private static final int MAX_KEYWORD_CANDIDATES = 120;

    /**
     * 검색어에 걸리는 것이 없을 때(개념 검색) 넓게 던지는 수.
     *
     * <p>"분위기 좋은 카페" 처럼 걸러낼 낱말이 없는 검색이 있다. 그때는 LLM 이 골라야 하므로 넓게 주되, 한도 안에 들어와야 하므로 여기서 끊는다. <b>이
     * 경로는 목록 앞쪽만 보게 되므로 재현율이 떨어진다</b> — 로그에 남겨 두고 나중에 카테고리 기반으로 개선할 자리다.
     */
    private static final int MAX_CONCEPT_CANDIDATES = 180;

    private static final int MAX_RESULTS = 40;

    /** 한 글자 낱말은 검색에 쓰지 않는다 — 조사·관형사가 후보를 전부 통과시킨다. */
    private static final int MIN_WORD_LENGTH = 2;

    private final UserLlmInvoker userLlmInvoker;
    private final PopupStoreService popupStoreService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, Object>> searchPopups(String query) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) return List.of();

        List<PopupStore> candidates = popupStoreService.findVisibleMapMarkers();
        if (candidates.isEmpty()) return List.of();

        /*
         * 검색어에 걸리는 것을 먼저 고른다.
         *
         * 예전에는 앞에서 400개를 그냥 잘라 넘겼다. 그게 두 가지를 한꺼번에 망가뜨리고 있었다 —
         * (1) 400개면 10,332 토큰이라 Groq 한도(8,000)를 넘겨 <b>모든 검색이 실패</b>했고,
         * (2) 자르고 남은 뒤쪽 600여 곳은 어떤 검색어로도 안 잡혔다. 지도에 핀이 떠 있는데
         * 검색하면 안 나오는 팝업이 있었다는 뜻이다.
         *
         * 검색어로 좁히면 둘 다 풀린다. 걸린 것만 넘기므로 토큰이 줄고, 목록 위치와 무관하게
         * 후보에 들어오므로 뒤쪽 팝업도 잡힌다.
         */
        List<PopupStore> bounded = narrowByQuery(q, candidates, MAX_KEYWORD_CANDIDATES);
        boolean conceptual = bounded.isEmpty();
        if (conceptual) {
            // 걸러낼 낱말이 없는 검색("분위기 좋은 카페"). LLM 이 골라야 하므로 넓게 주되 한도 안에서.
            bounded = candidates.subList(0, Math.min(MAX_CONCEPT_CANDIDATES, candidates.size()));
        }

        Map<String, PopupStore> byId =
                bounded.stream()
                        .collect(
                                Collectors.toMap(
                                        p -> String.valueOf(p.getId()),
                                        p -> p,
                                        (a, b) -> a,
                                        LinkedHashMap::new));

        log.info(
                "[AiSearch] q='{}' 후보={}/{} {}",
                q,
                bounded.size(),
                candidates.size(),
                conceptual ? "(개념검색 — 앞쪽만 봄)" : "(검색어 일치)");
        try {
            String response = userLlmInvoker.generate(buildPrompt(q, bounded), "AiSearch");
            return parseIds(response).stream()
                    .filter(byId::containsKey)
                    .distinct()
                    .limit(MAX_RESULTS)
                    .map(
                            id -> {
                                PopupStore p = byId.get(id);
                                Map<String, Object> m = new LinkedHashMap<>();
                                m.put("id", id);
                                m.put("name", p.getName());
                                m.put("location", nz(p.getLocation()));
                                return m;
                            })
                    .toList();
        } catch (Exception e) {
            log.error("[AiSearch] LLM 호출 실패", e);
            throw new IllegalStateException("AI 검색 실패: " + e.getMessage());
        }
    }

    /**
     * 검색어 낱말이 이름·장소·카테고리에 들어 있는 후보만 고른다.
     *
     * <p><b>많이 맞은 것이 앞에 온다.</b> "팝업" 같은 흔한 낱말은 거의 전부에 걸리는데, 순서를 안 매기면 그런 낱말 하나로 후보가 꽉 차서 정작 "성수" 까지
     * 맞는 팝업이 잘려 나간다.
     *
     * <p>번역명({@code nameEn}·{@code nameJa})도 본다. 외국어 화면에서 "Sanrio" 로 검색하는 사람이 한국어 이름만 있는 후보를 못 찾으면
     * 안 된다.
     *
     * @return 걸린 것이 없으면 <b>빈 목록</b>. 부르는 쪽이 그때 개념 검색으로 처리한다
     */
    static List<PopupStore> narrowByQuery(String query, List<PopupStore> candidates, int limit) {
        List<String> words =
                java.util.Arrays.stream(query.toLowerCase(Locale.ROOT).split("\\s+"))
                        .filter(w -> w.length() >= MIN_WORD_LENGTH)
                        .distinct()
                        .toList();
        if (words.isEmpty()) return List.of();

        record Scored(PopupStore popup, long hits) {}

        return candidates.stream()
                .map(p -> new Scored(p, countHits(p, words)))
                .filter(s -> s.hits() > 0)
                .sorted(java.util.Comparator.comparingLong(Scored::hits).reversed())
                .limit(limit)
                .map(Scored::popup)
                .toList();
    }

    private static long countHits(PopupStore popup, List<String> words) {
        String haystack =
                String.join(
                                " ",
                                nz(popup.getName()),
                                nz(popup.getLocation()),
                                nz(popup.getCategory()),
                                nz(popup.getNameEn()),
                                nz(popup.getNameJa()))
                        .toLowerCase(Locale.ROOT);
        return words.stream().filter(haystack::contains).count();
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
