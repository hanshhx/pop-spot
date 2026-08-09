package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.entity.PopupStore;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * AI 검색이 LLM 에 넘길 후보를 <b>검색어로 먼저 좁힌다.</b>
 *
 * <p><b>왜 이게 필요했나.</b> 2026-08-09 기준 AI 검색이 모든 검색어에서 실패하고 있었다. 후보 400곳을 통째로 프롬프트에 넣는데 그게 10,332
 * 토큰이고 Groq 한도가 8,000 이다. 팝업이 늘면서 어느 순간 선을 넘었고, 그 뒤로 조용히 계속 500 을 내고 있었다.
 *
 * <p>후보를 줄이면 토큰 문제가 풀린다. 그런데 그냥 줄이면 <b>재현율이 더 나빠진다</b> — 기존 코드는 {@code subList(0, 400)} 이라 1047곳 중
 * 647곳은 어떤 검색어로도 안 잡혔다. 지도에 핀이 멀쩡히 떠 있는데 검색하면 안 나오는 팝업이 있었다는 뜻이다.
 *
 * <p>그래서 <b>검색어에 걸리는 것을 먼저 고른다.</b> 목록 위치와 무관하게 후보에 들어오므로 토큰과 재현율이 같이 풀린다.
 */
class AiSearchCandidateTest {

    private static PopupStore popup(String name, String location, String category) {
        return PopupStore.builder().name(name).location(location).category(category).build();
    }

    private static final List<PopupStore> CATALOG =
            List.of(
                    popup("해즈빈 호텔 팝업스토어", "서울 영등포구 더현대 서울 지하 2층", "CHARACTER"),
                    popup("젠틀몬스터 팝업", "서울 성동구 성수동", "FASHION"),
                    popup("성수 감성 베이커리 팝업", "서울 성수동 연무장길", "FOOD"),
                    popup("올리브영 뷰티 팝업", "서울 명동", "BEAUTY"),
                    popup("루브르 특별전", "서울 서초구 예술의전당", "CULTURE"));

    @Test
    @DisplayName("이름에 걸리면 목록 어디에 있든 후보에 들어온다 — 앞 400곳만 보던 문제의 핵심")
    void picksByName() {
        List<PopupStore> picked = AiSearchService.narrowByQuery("해즈빈", CATALOG, 10);

        assertThat(picked).extracting(PopupStore::getName).contains("해즈빈 호텔 팝업스토어");
    }

    @Test
    @DisplayName("지역으로도 걸린다 — '성수' 는 이름이 아니라 주소에 있다")
    void picksByLocation() {
        List<PopupStore> picked = AiSearchService.narrowByQuery("성수", CATALOG, 10);

        assertThat(picked).extracting(PopupStore::getName).contains("젠틀몬스터 팝업", "성수 감성 베이커리 팝업");
    }

    /**
     * 낱말이 여러 개면 <b>많이 맞은 것이 앞에</b> 온다.
     *
     * <p>"팝업" 처럼 흔한 낱말은 거의 모두에 걸린다. 순서를 안 매기면 그런 낱말 하나로 후보가 꽉 차서, 정작 "성수" 까지 맞는 팝업이 잘려 나간다.
     */
    @Test
    @DisplayName("검색어 낱말이 많이 맞을수록 앞에 온다")
    void ranksByHowManyWordsMatch() {
        List<PopupStore> picked = AiSearchService.narrowByQuery("성수 팝업", CATALOG, 10);

        assertThat(picked).isNotEmpty();
        assertThat(picked.get(0).getLocation()).contains("성수");
    }

    @Test
    @DisplayName("한도를 넘겨 보내지 않는다 — 토큰 초과가 이 고장의 원인이었다")
    void respectsLimit() {
        List<PopupStore> many =
                IntStream.range(0, 500)
                        .mapToObj(i -> popup("성수 팝업 " + i, "서울 성수동", "FOOD"))
                        .toList();

        assertThat(AiSearchService.narrowByQuery("성수", many, 120)).hasSize(120);
    }

    /**
     * 걸리는 낱말이 없으면 <b>빈 목록</b>을 돌려준다. 호출부가 그때 개념 검색으로 보고 넓게 던진다 — 여기서 아무거나 채워 넣으면 "분위기 좋은 카페" 가 엉뚱한
     * 결과를 받는다.
     */
    @Test
    @DisplayName("걸리는 것이 없으면 비워서 돌려준다 — 호출부가 개념 검색으로 처리한다")
    void emptyWhenNothingMatches() {
        assertThat(AiSearchService.narrowByQuery("분위기 좋은 곳", CATALOG, 10)).isEmpty();
    }

    @Test
    @DisplayName("한 글자 낱말은 무시한다 — '이'·'의' 같은 것이 전부에 걸린다")
    void ignoresSingleCharacterWords() {
        assertThat(AiSearchService.narrowByQuery("이 의 를", CATALOG, 10)).isEmpty();
    }
}
