package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.VisitStatsDto;
import com.example.popspotbackend.entity.VisitLog;
import com.example.popspotbackend.repository.VisitLogRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 방문 로그 기록 + 어드민 집계. IP·개인정보는 다루지 않는다. */
@Service
@RequiredArgsConstructor
public class VisitService {

    private final VisitLogRepository visitLogRepository;

    /** 익명 방문 1건 기록. visitorId 가 비면 무시, 길이 초과 값은 컬럼 한도로 절단. */
    @Transactional
    public void record(String visitorId, String path, boolean guest) {
        if (visitorId == null || visitorId.isBlank()) return;
        String safeVisitor = clamp(visitorId, 64);
        String safePath = path == null ? null : clamp(path, 255);
        visitLogRepository.save(
                VisitLog.builder().visitorId(safeVisitor).path(safePath).guest(guest).build());
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

    private static String clamp(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static long num(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }
}
