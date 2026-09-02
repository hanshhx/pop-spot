package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.ai.UserLlmInvoker;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * AI 검색이 <b>언제 LLM 을 부르고, LLM 이 답을 못 냈을 때 무엇을 내놓는지</b>.
 *
 * <p><b>왜 이 검사가 생겼나.</b> 2026-09-02 에 "성수" 검색이 계속 0건이었다. 원인은 모델이 답하기 전에 길게 생각하고 그 생각도 출력 토큰을 먹는다는 데
 * 있었다 — 후보 120개를 놓고 따지다 상한(3,072)에 부딪혀 JSON 이 문자열 중간에서 잘렸다. 그리고 잘린 응답의 파싱 실패를 코드가 <b>조용히 삼켜 빈 목록으로
 * 바꿨다</b>.
 *
 * <p>그래서 고장이 "결과 없음" 과 똑같이 보였다. 화면에도, 로그에도, 사용자에게도. 여기서 지키는 것은 그 침묵을 다시 만들지 않는 것이다 — <b>낱말로 걸린 것이
 * 있으면 빈손으로 돌려보내지 않고, 되살릴 것조차 없으면 터뜨린다.</b>
 */
@ExtendWith(MockitoExtension.class)
class AiSearchServiceTest {

    @Mock private UserLlmInvoker userLlmInvoker;

    @Mock private PopupStoreService popupStoreService;

    private AiSearchService service;

    @BeforeEach
    void setUp() {
        service = new AiSearchService(userLlmInvoker, popupStoreService);
    }

    private static PopupStore popup(long id, String name, String location) {
        return PopupStore.builder().id(id).name(name).location(location).category("FOOD").build();
    }

    /** 그날 "제주" 로 실제로 걸리던 것들. 5619 가 진짜 답이고, 목록 맨 뒤에 있다. */
    private static final List<PopupStore> 지도 =
            List.of(
                    popup(1L, "도토리숲 지브리 팝업스토어", "서울 제주국제공항 도착층 3번 게이트앞"),
                    popup(2L, "스튜디오 지브리 팝업스토어", "서울 제주공항"),
                    popup(3L, "성수 감성 베이커리", "서울 성동구 성수동"),
                    popup(5619L, "2026 제주 로컬브랜드 팝업스토어", "서울 성동구 KT&G 상상플래닛"));

    private static List<Object> idsOf(List<Map<String, Object>> results) {
        return results.stream().map(m -> m.get("id")).toList();
    }

    @Test
    @DisplayName("낱말 하나짜리 조회는 LLM 을 아예 안 거친다 — 잘릴 일이 없어야 한다")
    void 조회는LLM을건너뛴다() {
        when(popupStoreService.findVisibleMapMarkers()).thenReturn(지도);

        List<Map<String, Object>> results = service.searchPopups("제주");

        assertThat(idsOf(results)).contains("5619");
        verify(userLlmInvoker, never()).generate(anyString(), anyString());
    }

    /**
     * 이 검사가 이 파일의 존재 이유다.
     *
     * <p>{@code ["1","56} 은 3,072 상한에 부딪혀 문자열 중간에서 끊긴 실제 모양이다. 예전 코드는 이걸 빈 목록으로 바꿔 200 으로 내보냈다.
     */
    @Test
    @DisplayName("응답이 잘려도 빈손으로 돌려보내지 않는다 — 낱말 일치로 되살린다")
    void 잘린응답에서되살린다() {
        when(popupStoreService.findVisibleMapMarkers()).thenReturn(지도);
        when(userLlmInvoker.generate(anyString(), anyString())).thenReturn("[\"1\",\"56");

        List<Map<String, Object>> results = service.searchPopups("제주 팝업");

        assertThat(results).isNotEmpty();
        assertThat(idsOf(results)).contains("5619");
    }

    /* 조회만 빠르게 만들고 개념 검색까지 낱말 대조로 퇴화시키면, 화면의 예시 칩 네 개가 죽는다. */
    @Test
    @DisplayName("낱말이 여럿이면 LLM 이 고른다 — 단순 대조로 퇴화하지 않는다")
    void 개념검색은LLM이고른다() {
        when(popupStoreService.findVisibleMapMarkers()).thenReturn(지도);
        when(userLlmInvoker.generate(anyString(), anyString())).thenReturn("[\"3\"]");

        List<Map<String, Object>> results = service.searchPopups("성수 감성 카페");

        assertThat(idsOf(results)).containsExactly("3");
        verify(userLlmInvoker).generate(anyString(), anyString());
    }

    @Test
    @DisplayName("LLM 이 없다고 답하면 없다고 답한다 — 억지로 채우지 않는다")
    void 진짜없으면빈목록() {
        when(popupStoreService.findVisibleMapMarkers()).thenReturn(지도);
        when(userLlmInvoker.generate(anyString(), anyString())).thenReturn("[]");

        assertThat(service.searchPopups("아이랑 가기 좋은 곳")).isEmpty();
    }

    /* 침묵 금지. 되살릴 것이 없는데도 빈 목록을 내보내면 고장이 다시 '결과 없음' 으로 위장한다. */
    @Test
    @DisplayName("되살릴 낱말 일치조차 없으면 조용히 넘어가지 않고 터뜨린다")
    void 되살릴것이없으면터뜨린다() {
        when(popupStoreService.findVisibleMapMarkers()).thenReturn(지도);
        when(userLlmInvoker.generate(anyString(), anyString()))
                .thenReturn("죄송합니다. 목록에서 고를 수 없었습니다.");

        assertThatThrownBy(() -> service.searchPopups("분위기 좋은 곳"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("검색어가 비었거나 지도에 아무것도 없으면 LLM 을 안 부른다")
    void 부를이유가없으면안부른다() {
        assertThat(service.searchPopups("  ")).isEmpty();

        when(popupStoreService.findVisibleMapMarkers()).thenReturn(List.of());
        assertThat(service.searchPopups("제주")).isEmpty();

        verify(userLlmInvoker, never()).generate(anyString(), anyString());
    }
}
