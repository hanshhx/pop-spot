package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.ai.UserLlmInvoker;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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

    /* 관련도 가중치 — 이름 앞부분 > 이름 어딘가 > 주소·분류에만. 자세한 이유는 scoreOf 에 적었다. */
    private static final int NAME_PREFIX_SCORE = 4;
    private static final int NAME_SCORE = 3;
    private static final int LOCATION_SCORE = 1;

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
        List<PopupStore> matched = narrowByQuery(q, candidates, MAX_KEYWORD_CANDIDATES);

        /*
         * 낱말 하나짜리 검색은 이름·지역 조회다("제주", "성수", "마뗑킴"). 답이 이미 정해져 있으므로
         * LLM 을 태우지 않는다 — 빠르고, 토큰을 안 쓰고, 무엇보다 <b>잘릴 일이 없다</b>.
         *
         * 2026-09-02 에 이 경로가 조용히 죽어 있었다. gpt-oss-120b 는 답하기 전에 길게 생각하고 그
         * 생각도 출력 토큰을 먹는데, 후보 120개를 놓고 따지다 상한(3,072)에 부딪혀 JSON 이 중간에서
         * 잘렸다. 잘린 응답은 파싱에 실패하고, 그 실패가 빈 목록으로 둔갑해 "결과 없음" 과 구별되지
         * 않았다. 조회에까지 LLM 을 쓸 이유가 없다.
         */
        if (isLookup(q) && !matched.isEmpty()) {
            log.info("[AiSearch] q='{}' 낱말조회 {}/{} — LLM 생략", q, matched.size(), candidates.size());
            return toResults(matched);
        }

        boolean conceptual = matched.isEmpty();
        // 걸러낼 낱말이 없는 검색("분위기 좋은 카페"). LLM 이 골라야 하므로 넓게 주되 한도 안에서.
        List<PopupStore> bounded =
                conceptual
                        ? candidates.subList(0, Math.min(MAX_CONCEPT_CANDIDATES, candidates.size()))
                        : matched;

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
            return toResults(
                    parseIds(response).stream()
                            .filter(byId::containsKey)
                            .distinct()
                            .map(byId::get)
                            .toList());
        } catch (Exception e) {
            /*
             * LLM 호출 실패와 응답 파싱 실패를 한 자리에서 받는다. 둘 다 "AI 가 답을 못 냈다" 는
             * 하나의 사건이고, 사용자에게 중요한 것은 그다음이다 — 낱말로 걸린 것이 있으면 그것이라도
             * 내놓는다. 예전에는 파싱 실패를 {@code parseIds} 안에서 삼켜 빈 목록을 돌려줬는데,
             * 그러면 고장이 "결과 없음" 으로 보여서 아무도 눈치채지 못한다.
             */
            log.error("[AiSearch] LLM 호출·해석 실패 — q='{}'", q, e);
            if (!matched.isEmpty()) {
                log.warn("[AiSearch] 낱말 일치 {}건으로 대체한다", matched.size());
                return toResults(matched);
            }
            throw new IllegalStateException("AI 검색 실패: " + e.getMessage());
        }
    }

    /**
     * 공백 없는 한 낱말은 <b>이름·지역 조회</b>로 본다.
     *
     * <p>낱말이 여럿이면 "비 오는 날 감성 카페" 처럼 뜻을 읽어야 하는 검색일 수 있다. 그런 것까지 낱말 대조로 답해 버리면 AI 검색이 단순 대조로 퇴화한다 —
     * 화면의 예시 칩 네 개가 전부 그 부류다.
     */
    static boolean isLookup(String query) {
        return query.trim().split("\\s+").length == 1;
    }

    /** 프론트가 지도 핀 필터(맵)·결과 목록(모달) 양쪽에 쓰는 모양으로 맞춘다. */
    private List<Map<String, Object>> toResults(List<PopupStore> popups) {
        return popups.stream()
                .limit(MAX_RESULTS)
                .map(
                        p -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("id", String.valueOf(p.getId()));
                            m.put("name", p.getName());
                            m.put("location", nz(p.getLocation()));
                            return m;
                        })
                .toList();
    }

    /**
     * 검색어 낱말이 이름·장소·카테고리에 들어 있는 후보만 고른다.
     *
     * <p><b>관련도가 높은 것이 앞에 온다.</b> "팝업" 같은 흔한 낱말은 거의 전부에 걸리는데, 순서를 안 매기면 그런 낱말 하나로 후보가 꽉 차서 정작 "성수"
     * 까지 맞는 팝업이 잘려 나간다. 점수 기준은 {@link #scoreOf} 를 본다.
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

        record Scored(PopupStore popup, long score) {}

        /* 동점은 원래 차례를 지킨다 — sorted 는 안정 정렬이다. */
        return candidates.stream()
                .map(p -> new Scored(p, scoreOf(p, words)))
                .filter(s -> s.score() > 0)
                .sorted(java.util.Comparator.comparingLong(Scored::score).reversed())
                .limit(limit)
                .map(Scored::popup)
                .toList();
    }

    /**
     * 관련도 점수. <b>이름에 걸린 것이 주소에만 걸린 것을 이긴다.</b>
     *
     * <p>2026-09-02 에 "제주" 로 검색하면 「2026 제주 로컬브랜드 팝업스토어」가 뒤로 밀려 안 보였다. 걸린 낱말 수만 세면 이름이 「제주…」인 팝업과
     * 주소가 「서울 제주공항」인 지브리 팝업이 <b>똑같이 1점</b>이라, 순서가 후보 목록에 실린 차례로 정해졌다. 이름으로 찾는 사람에게는 이름이 먼저다.
     *
     * <p>번역명({@code nameEn}·{@code nameJa})도 이름으로 친다. 외국어 화면에서 "Sanrio" 로 찾는 사람이 한국어 이름만 있는 후보를 못
     * 찾으면 안 된다.
     */
    private static long scoreOf(PopupStore popup, List<String> words) {
        String name =
                String.join(" ", nz(popup.getName()), nz(popup.getNameEn()), nz(popup.getNameJa()))
                        .toLowerCase(Locale.ROOT)
                        .trim();
        String rest =
                String.join(" ", nz(popup.getLocation()), nz(popup.getCategory()))
                        .toLowerCase(Locale.ROOT);
        long score = 0;
        for (String word : words) {
            if (name.startsWith(word)) score += NAME_PREFIX_SCORE;
            else if (name.contains(word)) score += NAME_SCORE;
            else if (rest.contains(word)) score += LOCATION_SCORE;
        }
        return score;
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

    /**
     * LLM 응답에서 id 목록을 꺼낸다.
     *
     * <p><b>실패를 삼키지 않는다.</b> 예전에는 여기서 파싱 오류를 잡아 빈 목록을 돌려줬다. 그러면 응답이 <b>잘려서</b> 못 읽은 것과 LLM 이 "맞는 게
     * 없다" 고 답한 것이 화면에서 똑같이 보인다 — 고장이 "결과 없음" 으로 위장한다. 부르는 쪽이 낱말 일치로 되살릴 수 있도록 그대로 던진다.
     */
    private List<String> parseIds(String responseText) throws JsonProcessingException {
        String clean = responseText.replaceAll("```json", "").replaceAll("```", "").trim();
        List<?> raw = objectMapper.readValue(clean, List.class);
        return raw.stream().map(String::valueOf).toList();
    }

    private static String nz(String s) {
        return s == null ? "" : s.replace("\n", " ").replace("|", "/");
    }
}
