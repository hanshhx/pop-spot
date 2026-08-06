package com.example.popspotbackend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 세션 요약의 <b>나눗셈</b>을 못박는다.
 *
 * <p>이 계산을 화면이 아니라 여기서 하는 이유가 그대로 시험 항목이다 — 분모가 0 인 자리가 셋이고, 화면마다 나누면 그 셋을 화면 수만큼 다시 만들게 된다. 방문이 없는
 * 날 관리자 표에 {@code NaN} 이나 {@code Infinity} 가 뜨면 "집계가 고장났다" 로 읽힌다.
 */
class SessionStatsDtoTest {

    @Test
    @DisplayName("아무도 안 온 기간에도 숫자가 나온다 — NaN·Infinity 금지")
    void emptyPeriodIsAllZeros() {
        SessionStatsDto d = SessionStatsDto.of(0, 0, 0, 0, 90, false);

        assertThat(d.returnRate()).isZero();
        assertThat(d.eventsPerSession()).isZero();
        assertThat(d.sessionsPerVisitor()).isZero();
        assertThat(d.newVisitors()).isZero();
    }

    @Test
    @DisplayName("재방문율은 방문자 대비 백분율")
    void returnRateIsPercentOfVisitors() {
        // 방문자 200명 중 50명이 전에도 왔다 → 25%
        SessionStatsDto d = SessionStatsDto.of(260, 200, 900, 50, 90, false);

        assertThat(d.returningVisitors()).isEqualTo(50);
        assertThat(d.newVisitors()).isEqualTo(150);
        assertThat(d.returnRate()).isEqualTo(25.0);
    }

    @Test
    @DisplayName("세션당 행동 · 방문자당 세션은 소수 첫째 자리까지")
    void averagesAreRoundedToOneDecimal() {
        SessionStatsDto d = SessionStatsDto.of(3, 2, 10, 0, 90, false);

        assertThat(d.eventsPerSession()).isEqualTo(3.3); // 10/3 = 3.333…
        assertThat(d.sessionsPerVisitor()).isEqualTo(1.5); // 3/2
    }

    /**
     * 집계 중에 새 방문이 들어오면 두 쿼리가 서로 다른 순간을 볼 수 있다. 그때 재방문자가 방문자보다 많게 나오면 신규가 음수가 되어 표가 이상해진다 — 화면이 아니라
     * 여기서 막는다.
     */
    @Test
    @DisplayName("재방문자가 방문자보다 많아도 신규가 음수가 되지 않는다")
    void neverNegativeNewVisitors() {
        SessionStatsDto d = SessionStatsDto.of(10, 5, 20, 7, 90, false);

        assertThat(d.returningVisitors()).isEqualTo(5); // 방문자 수에서 자른다
        assertThat(d.newVisitors()).isZero();
        assertThat(d.returnRate()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("음수 입력도 0 으로 눕힌다 — 쿼리가 이상해져도 표는 읽힌다")
    void negativeInputsAreClamped() {
        SessionStatsDto d = SessionStatsDto.of(0, 10, 0, -3, 90, false);

        assertThat(d.returningVisitors()).isZero();
        assertThat(d.newVisitors()).isEqualTo(10);
    }

    /**
     * 재방문 판정은 보관기간 안에서만 가능하다. 90일 보관인데 90일 구간을 물으면 앞쪽에는 비교할 과거가 없어 그 사람들이 전부 신규로 잡힌다. 그 사실이 값에 담기지
     * 않으면 <b>화면은 멀쩡한데 숫자만 틀린다</b> — 보는 사람이 알 방법이 없다.
     */
    @Test
    @DisplayName("보관기간 이상을 물으면 잘렸다고 표시한다")
    void truncatedFlagIsCarried() {
        assertThat(SessionStatsDto.of(1, 1, 1, 0, 90, true).truncated()).isTrue();
        assertThat(SessionStatsDto.of(1, 1, 1, 0, 90, false).truncated()).isFalse();
        assertThat(SessionStatsDto.of(1, 1, 1, 0, 90, false).retentionDays()).isEqualTo(90);
    }
}
