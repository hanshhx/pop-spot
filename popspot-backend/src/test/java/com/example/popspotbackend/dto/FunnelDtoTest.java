package com.example.popspotbackend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 퍼널의 <b>비율 계산</b>을 못박는다.
 *
 * <p>이 계산을 화면이 아니라 여기서 하는 이유가 그대로 시험 항목이다 — 분모가 0 인 자리가 칸마다
 * 있어서, 화면에서 나누면 그 자리를 화면 수만큼 다시 만들게 된다.
 */
class FunnelDtoTest {

    private static FunnelDto.Raw raw(String key, long visitors) {
        return new FunnelDto.Raw(key, key, visitors, "");
    }

    @Test
    @DisplayName("첫 칸 대비 · 앞 칸 대비를 둘 다 준다")
    void bothRatiosAreComputed() {
        FunnelDto f =
                FunnelDto.of(
                        List.of(raw("visit", 1000), raw("open", 250), raw("wishlist", 50)),
                        "2026-08-01T00:00",
                        "");

        assertThat(f.steps()).hasSize(3);
        assertThat(f.steps().get(0).ofFirst()).isEqualTo(100.0);
        assertThat(f.steps().get(0).ofPrev()).isEqualTo(100.0);

        assertThat(f.steps().get(1).ofFirst()).isEqualTo(25.0); // 250/1000
        assertThat(f.steps().get(1).ofPrev()).isEqualTo(25.0);

        assertThat(f.steps().get(2).ofFirst()).isEqualTo(5.0); // 50/1000
        assertThat(f.steps().get(2).ofPrev()).isEqualTo(20.0); // 50/250 — 여기가 진짜 이탈 지점
    }

    @Test
    @DisplayName("아무도 안 왔어도 숫자가 나온다 — NaN 금지")
    void emptyFunnelIsAllZeros() {
        FunnelDto f = FunnelDto.of(List.of(raw("visit", 0), raw("open", 0)), "x", "");

        assertThat(f.steps().get(0).ofFirst()).isZero();
        assertThat(f.steps().get(1).ofFirst()).isZero();
        assertThat(f.steps().get(1).ofPrev()).isZero();
    }

    @Test
    @DisplayName("중간이 0 이어도 뒤 칸이 터지지 않는다")
    void zeroInTheMiddleDoesNotBreakLaterSteps() {
        FunnelDto f =
                FunnelDto.of(
                        List.of(raw("visit", 100), raw("open", 0), raw("wishlist", 0)), "x", "");

        assertThat(f.steps().get(2).ofPrev()).isZero();
    }

    /**
     * 아래 칸이 위 칸보다 클 수는 없어야 정상이다. 그런데 수집 시작일이 칸마다 다르거나 링크를 직접
     * 받아 들어오면 그런 값이 나온다. 그때 <b>100% 로 잘라 숨기지 않는다</b> — 억지로 맞추면
     * "이상하다" 는 신호까지 지워져, 보는 사람이 데이터를 의심할 기회를 잃는다.
     */
    @Test
    @DisplayName("뒤 칸이 앞 칸보다 크면 100% 를 넘겨 그대로 보여 준다")
    void doesNotHideImpossibleRatios() {
        FunnelDto f = FunnelDto.of(List.of(raw("visit", 10), raw("open", 25)), "x", "");

        assertThat(f.steps().get(1).ofPrev()).isEqualTo(250.0);
    }

    @Test
    @DisplayName("수집 시작일과 안내 문구를 그대로 실어 보낸다")
    void carriesCollectionStartAndNote() {
        FunnelDto f =
                FunnelDto.of(
                        List.of(
                                raw("visit", 10),
                                new FunnelDto.Raw("wishlist", "찜", 1, "2026-08-05")),
                        "2026-07-06T00:00",
                        "찜(2026-08-05부터)");

        assertThat(f.steps().get(1).collectedSince()).isEqualTo("2026-08-05");
        assertThat(f.note()).contains("2026-08-05");
        assertThat(f.since()).isEqualTo("2026-07-06T00:00");
    }

    @Test
    @DisplayName("note 가 null 이면 빈 문자열 — 화면에 'null' 이 찍히지 않게")
    void nullNoteBecomesEmpty() {
        assertThat(FunnelDto.of(List.of(raw("visit", 1)), "x", null).note()).isEmpty();
    }
}
