package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.VisitStatsDto;
import com.example.popspotbackend.entity.VisitLog;
import com.example.popspotbackend.repository.VisitLogRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 방문 로그 기록 + 어드민 집계. IP·개인정보는 다루지 않는다. */
@Service
@RequiredArgsConstructor
public class VisitService {

    private final VisitLogRepository visitLogRepository;

    /** 익명 방문 1건 기록. visitorId 가 비면 무시, 길이 초과 값은 컬럼 한도로 절단. UA 는 봇 식별용으로 저장. */
    @Transactional
    public void record(String visitorId, String path, boolean guest, String userAgent) {
        if (visitorId == null || visitorId.isBlank()) return;
        String safeVisitor = clamp(visitorId, 64);
        String safePath = path == null ? null : clamp(path, 255);
        String safeUa = userAgent == null ? null : clamp(userAgent, 400);
        visitLogRepository.save(
                VisitLog.builder()
                        .visitorId(safeVisitor)
                        .path(safePath)
                        .guest(guest)
                        .userAgent(safeUa)
                        .build());
    }

    @Transactional(readOnly = true)
    public VisitStatsDto getStats() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime weekStart = todayStart.minusDays(6);

        List<VisitStatsDto.DailyCount> daily =
                visitLogRepository.dailyVisitorsSince(weekStart).stream()
                        .map(r -> new VisitStatsDto.DailyCount(str(r[0]), num(r[1])))
                        .toList();
        List<VisitStatsDto.PathCount> topPaths =
                visitLogRepository.topPathsSince(weekStart).stream()
                        .map(r -> new VisitStatsDto.PathCount(str(r[0]), num(r[1])))
                        .toList();

        return new VisitStatsDto(
                visitLogRepository.countDistinctVisitorsSince(todayStart),
                visitLogRepository.countPageviewsSince(todayStart),
                visitLogRepository.countDistinctVisitorsByGuestSince(todayStart, true),
                visitLogRepository.countDistinctVisitorsByGuestSince(todayStart, false),
                visitLogRepository.countDistinctVisitorsSince(weekStart),
                daily,
                topPaths);
    }

    /** 오늘 방문 경로별 집계 — 경로 · 총 페이지뷰 · 회원 뷰 · 게스트/봇 뷰. 유입 진단용. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTodayPaths() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        return visitLogRepository.pathBreakdownSince(todayStart).stream()
                .map(
                        r -> {
                            long total = num(r[1]);
                            long members = num(r[2]);
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("path", str(r[0]));
                            m.put("total", total);
                            m.put("members", members);
                            m.put("guests", total - members);
                            return m;
                        })
                .toList();
    }

    /** 방문자 목록 — 최근 days 일(기본 7, 최대 30) 내 visitorId 단위 집계. 게스트/회원 구분해 나열. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRecentVisitors(int days) {
        int safeDays = days <= 0 ? 7 : Math.min(days, 30);
        LocalDateTime since = LocalDate.now().minusDays(safeDays - 1L).atStartOfDay();
        return visitLogRepository.recentVisitors(since).stream()
                .map(
                        r -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("visitorId", str(r[0]));
                            m.put("visits", num(r[1]));
                            m.put("paths", str(r[2]));
                            m.put("lastSeen", str(r[3]));
                            m.put("guest", bool(r[4])); // all_guest: true=순수 게스트, false=회원 이력
                            m.put("userAgent", str(r[5])); // 봇 식별용(배포 후 방문부터 채워짐)
                            return m;
                        })
                .toList();
    }

    private static String clamp(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static boolean bool(Object o) {
        if (o instanceof Boolean b) return b;
        String s = str(o);
        return "t".equals(s) || "true".equals(s);
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static long num(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }
}
