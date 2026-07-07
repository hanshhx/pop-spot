package com.example.popspotbackend.dto;

import java.util.List;

/** 어드민 방문 통계 응답. 모두 익명 집계값(개인 식별 불가). */
public record VisitStatsDto(
        long todayVisitors,
        long todayPageviews,
        long todayGuests,
        long todayMembers,
        long weekVisitors,
        List<DailyCount> daily,
        List<PathCount> topPaths) {

    /** 일자별 고유 방문자 수. */
    public record DailyCount(String date, long visitors) {}

    /** 경로별 방문(페이지뷰) 수. */
    public record PathCount(String path, long count) {}
}
