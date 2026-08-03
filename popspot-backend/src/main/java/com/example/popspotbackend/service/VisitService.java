package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.VisitStatsDto;
import com.example.popspotbackend.entity.VisitLog;
import com.example.popspotbackend.repository.VisitLogRepository;
import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 방문 로그 기록 + 어드민 집계. IP·개인정보는 다루지 않는다. */
@Service
@RequiredArgsConstructor
@Slf4j
public class VisitService {

    /** 우리 도메인 — 여기서 온 이동은 유입이 아니라 사이트 내 이동이다. */
    private static final Set<String> INTERNAL_HOSTS =
            Set.of("popspot.co.kr", "localhost", "127.0.0.1");

    private final VisitLogRepository visitLogRepository;

    @Value("${popspot.visit-log.retention-days:90}")
    private int retentionDays;

    /** 익명 방문 1건 기록. visitorId 가 비면 무시, 길이 초과 값은 컬럼 한도로 절단. UA 는 봇 식별용, referrer 는 출처 도메인만 저장. */
    @Transactional
    public void record(
            String visitorId, String path, boolean guest, String userAgent, String referrer) {
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
                        .referrerHost(normalizeReferrerHost(referrer))
                        .build());
    }

    /**
     * 유입 출처를 "도메인 또는 분류값" 으로 정규화한다.
     *
     * <p>전체 URL 은 절대 저장하지 않는다 — 리퍼러 쿼리스트링에는 검색어·토큰 같은 개인정보가 실릴 수 있고, 이 서비스는 IP 도 안 남기는 방침이라 도메인만
     * 남기는 것이 일관된다. 빈 값·파싱 실패는 direct(주소 직접 입력·북마크·앱에서 열기), 우리 도메인은 internal(사이트 내 이동)로 묶는다.
     */
    private static String normalizeReferrerHost(String referrer) {
        if (referrer == null || referrer.isBlank()) return "direct";
        String host;
        try {
            host = URI.create(referrer.trim()).getHost();
        } catch (IllegalArgumentException e) {
            return "direct"; // 깨진 URL — 어차피 출처를 알 수 없다
        }
        if (host == null || host.isBlank()) return "direct"; // 상대경로·about: 등 호스트 없는 값
        String lower = host.toLowerCase(Locale.ROOT);
        // www 등 서브도메인과 vercel 프리뷰 배포도 우리 사이트다.
        if (INTERNAL_HOSTS.contains(lower)
                || lower.endsWith(".popspot.co.kr")
                || lower.endsWith(".vercel.app")) {
            return "internal";
        }
        return clamp(lower, 255);
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

    /**
     * 조회 가능한 최대 기간.
     *
     * <p>방문 기록 자체가 보관 기간(기본 90일)이 지나면 지워지므로, 그보다 길게 물어봐야 나올 것이 없다.
     */
    private static final int MAX_LOOKBACK_DAYS = 90;

    /** 한 페이지에 담을 최대 인원. 화면이 감당 못 할 양을 요청해 서버를 붙잡지 못하게 한다. */
    private static final int VISITORS_PAGE_MAX = 200;

    private static final int VISITORS_PAGE_DEFAULT = 50;

    /**
     * 방문자 목록 — 최근 days 일 내 visitorId 단위 집계. 게스트/회원 구분해 나열.
     *
     * <p>총 인원과 함께 돌려준다. 목록만 주면 화면이 "다음 페이지가 있는지" 를 알 수 없어, 빈 페이지를 눌러 보고 나서야 끝을 안다.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getRecentVisitors(int days, int page, int size) {
        int safeDays = days <= 0 ? 7 : Math.min(days, MAX_LOOKBACK_DAYS);
        int safeSize = size <= 0 ? VISITORS_PAGE_DEFAULT : Math.min(size, VISITORS_PAGE_MAX);
        int safePage = Math.max(page, 0);
        LocalDateTime since = LocalDate.now().minusDays(safeDays - 1L).atStartOfDay();

        List<Map<String, Object>> rows =
                visitLogRepository.recentVisitors(since, safeSize, safePage * safeSize).stream()
                        .map(
                                r -> {
                                    Map<String, Object> m = new LinkedHashMap<>();
                                    m.put("visitorId", str(r[0]));
                                    m.put("visits", num(r[1]));
                                    // 다녀간 경로. 한때 개수만 보냈는데, 운영에서 실제로 쓰는 값이라
                                    // 되돌렸다 — "이 방문자가 어디를 봤나" 는 봇 판정과 유입 진단 양쪽에
                                    // 쓰인다. 개수(pathCount)는 한눈에 보라고 함께 준다.
                                    m.put("paths", str(r[2]));
                                    m.put("lastSeen", str(r[3]));
                                    m.put(
                                            "guest",
                                            bool(r[4])); // all_guest: true=순수 게스트, false=회원 이력
                                    m.put("userAgent", str(r[5])); // 봇 식별용(배포 후 방문부터 채워짐)
                                    m.put("pathCount", num(r[6]));
                                    return m;
                                })
                        .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", rows);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("totalElements", visitLogRepository.countVisitors(since));
        result.put("days", safeDays);
        return result;
    }

    /** 개인정보 처리방침의 3개월 보관 약속을 코드로 강제한다. 매일 04:40 KST에 만료 로그를 제거한다. */
    @Scheduled(cron = "${popspot.visit-log.cleanup-cron:0 40 4 * * *}", zone = "Asia/Seoul")
    @Transactional
    public void deleteExpiredVisitLogs() {
        int safeRetentionDays = Math.max(1, retentionDays);
        int deleted =
                visitLogRepository.deleteByCreatedAtBefore(
                        LocalDateTime.now().minusDays(safeRetentionDays));
        if (deleted > 0) {
            log.info(
                    "[VisitLog] 보관기간 초과 로그 삭제 count={} retentionDays={}",
                    deleted,
                    safeRetentionDays);
        }
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
