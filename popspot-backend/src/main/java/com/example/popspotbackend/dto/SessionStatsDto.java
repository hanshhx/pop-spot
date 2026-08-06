package com.example.popspotbackend.dto;

/**
 * C-3 — 세션 기준으로 본 방문. "몇 명이 왔나" 옆에 "그 사람들이 <b>다시</b> 오나" 를 놓는다.
 *
 * <p><b>왜 필요했나.</b> 수집 쪽은 이미 {@code visit_event.session_id} 를 채우고 있었는데, 그것을 읽는 관리자 API 가 하나도 없었다.
 * 원재료만 쌓이고 조리를 안 한 상태였다. 그래서 방문자 CSV 로는 재방문율을 계산할 수 없었고, 유입만 늘리고 <b>남는지는 모르는</b> 상태가 이어졌다.
 *
 * @param sessions 기간 안의 서로 다른 세션 수. {@code session_id} 가 없는 옛 기록은 빠진다
 * @param visitors 기간 안의 서로 다른 방문자 수
 * @param events 기간 안의 행동 기록 수
 * @param returningVisitors 그중 <b>기간 이전에도 왔던</b> 사람 수
 * @param newVisitors {@code visitors - returningVisitors}
 * @param returnRate 재방문율(%). 방문자가 0 이면 0
 * @param eventsPerSession 세션당 평균 행동 수. 세션이 0 이면 0
 * @param sessionsPerVisitor 방문자당 평균 세션 수. 방문자가 0 이면 0
 * @param retentionDays 재방문을 판정할 수 있는 최대 과거 구간(= 보관기간)
 * @param truncated 기간 시작이 보관 한계보다 이르면 {@code true} — 그만큼 재방문이 덜 잡힌다
 */
public record SessionStatsDto(
        long sessions,
        long visitors,
        long events,
        long returningVisitors,
        long newVisitors,
        double returnRate,
        double eventsPerSession,
        double sessionsPerVisitor,
        int retentionDays,
        boolean truncated) {

    /**
     * 원시 카운트에서 비율을 계산해 만든다.
     *
     * <p><b>나눗셈을 화면에 미루지 않는다.</b> 프론트에서 나누면 0 으로 나누는 자리가 화면 수만큼 생기고, 반올림 자리도 화면마다 달라진다. 여기서 한 번만
     * 정한다.
     *
     * <p>재방문자가 방문자보다 많을 수는 없지만, 두 쿼리가 서로 다른 순간을 보면(집계 중 새 방문이 들어오면) 그런 값이 나올 수 있다. 그때 신규가 음수가 되면 표가
     * 이상해지므로 0 에서 자른다.
     */
    public static SessionStatsDto of(
            long sessions,
            long visitors,
            long events,
            long returning,
            int retentionDays,
            boolean truncated) {
        long safeReturning = Math.min(Math.max(returning, 0), Math.max(visitors, 0));
        long newVisitors = Math.max(visitors - safeReturning, 0);
        return new SessionStatsDto(
                sessions,
                visitors,
                events,
                safeReturning,
                newVisitors,
                ratio(safeReturning * 100.0, visitors),
                ratio(events, sessions),
                ratio(sessions, visitors),
                retentionDays,
                truncated);
    }

    /** 소수 첫째 자리까지. 분모가 0 이면 0 — 화면에 NaN 이나 Infinity 가 나가지 않게. */
    private static double ratio(double numerator, long denominator) {
        if (denominator <= 0) return 0;
        return Math.round((numerator / denominator) * 10.0) / 10.0;
    }
}
