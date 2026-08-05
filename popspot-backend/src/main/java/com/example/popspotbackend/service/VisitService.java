package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.SessionStatsDto;
import com.example.popspotbackend.dto.VisitStatsDto;
import com.example.popspotbackend.entity.VisitEvent;
import com.example.popspotbackend.entity.VisitLog;
import com.example.popspotbackend.repository.VisitEventRepository;
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
    private final VisitEventRepository visitEventRepository;

    @Value("${popspot.visit-log.retention-days:90}")
    private int retentionDays;

    /** 익명 방문 1건 기록. visitorId 가 비면 무시, 길이 초과 값은 컬럼 한도로 절단. UA 는 봇 식별용, referrer 는 출처 도메인만 저장. */
    @Transactional
    public void record(
            String visitorId,
            String path,
            boolean guest,
            String userAgent,
            String referrer,
            String utmSource,
            String utmMedium,
            String utmCampaign) {
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
                        .utmSource(safeUtm(utmSource))
                        .utmMedium(safeUtm(utmMedium))
                        .utmCampaign(safeUtm(utmCampaign))
                        .build());
    }

    /**
     * UTM 값 정리 — 허용 문자만 남기고 길이를 자른다.
     *
     * <p>이 값은 <b>사용자가 주소창으로 보내는 것</b>이라 무엇이든 올 수 있다. 그대로 저장하면 집계 화면에 임의의 문자열이 뜨고, 캠페인 이름이 제각각이 되어
     * 같은 캠페인이 여러 줄로 갈라진다. 실제 UTM 은 영숫자와 몇 개의 구분자로 이뤄지므로 그 밖은 버린다.
     *
     * <p>거르고 나서 비면 없는 것으로 둔다 — 빈 문자열을 저장하면 집계에 이름 없는 줄이 생긴다.
     */
    private static String safeUtm(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String cleaned = raw.trim().toLowerCase().replaceAll("[^a-z0-9._-]", "");
        // 영숫자가 하나도 없으면 없는 것으로 둔다.
        //
        // 빈 문자열만 걸러서는 부족하다 — 한글로만 지은 캠페인명("여름_팝업")은 글자가 다 걸러지고
        // 구분자만 남아 "_" 가 된다. 그러면 집계 화면에 이름 같지 않은 줄이 생기고, 서로 다른
        // 한글 캠페인이 전부 같은 "_" 로 뭉쳐 한 줄이 된다.
        if (!cleaned.matches(".*[a-z0-9].*")) return null;
        return clamp(cleaned, 100);
    }

    /**
     * 방문 안에서 일어난 행동 하나를 남긴다.
     *
     * <p>종류가 목록에 없으면 <b>조용히 버린다.</b> 클라이언트가 보낸 값이라 무엇이든 올 수 있는데, 그대로 저장하면 오타가 새 종류로 쌓여 집계가 갈라지고 예상
     * 못 한 값이 DB 에 들어간다. 400 으로 알려 주지 않는 이유는 이것이 비콘이기 때문이다 — 화면이 실패를 처리할 방법도, 처리할 이유도 없다.
     */
    @Transactional
    public void recordEvent(
            String visitorId,
            String sessionId,
            String eventType,
            Long popupId,
            String path,
            boolean guest) {
        if (visitorId == null || visitorId.isBlank()) return;
        if (eventType == null || !VisitEvent.ALLOWED_TYPES.contains(eventType)) return;

        visitEventRepository.save(
                VisitEvent.builder()
                        .visitorId(clamp(visitorId, 64))
                        .sessionId(sessionId == null ? null : clamp(sessionId, 64))
                        .eventType(eventType)
                        .popupId(popupId)
                        .path(path == null ? null : clamp(path, 255))
                        .guest(guest)
                        .build());
    }

    /** 유입 캠페인별 방문자 수 — 어떤 홍보가 실제로 데려왔나. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> campaigns(int days) {
        int safeDays = days <= 0 ? 30 : Math.min(days, MAX_LOOKBACK_DAYS);
        LocalDateTime since = LocalDate.now().minusDays(safeDays - 1L).atStartOfDay();

        return visitLogRepository.campaignsSince(since).stream()
                .map(
                        r -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("source", str(r[0]));
                            m.put("medium", str(r[1]));
                            m.put("campaign", str(r[2]));
                            // 횟수가 아니라 사람 수다. 캠페인이 데려온 것은 사람이지 클릭이 아니다.
                            m.put("visitors", num(r[3]));
                            return m;
                        })
                .toList();
    }

    /** 많이 열린 팝업 — 누른 횟수와 누른 사람 수를 함께 준다. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> topOpenedPopups(int days, int limit) {
        int safeDays = days <= 0 ? 7 : Math.min(days, MAX_LOOKBACK_DAYS);
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 100);
        LocalDateTime since = LocalDate.now().minusDays(safeDays - 1L).atStartOfDay();

        return visitEventRepository.topPopups(since, VisitEvent.TYPE_POPUP_OPEN, safeLimit).stream()
                .map(
                        r -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("popupId", num(r[0]));
                            // 지워진 팝업이면 이름이 없다. 화면이 id 만으로도 보여 준다.
                            m.put("name", str(r[1]));
                            m.put("opens", num(r[2]));
                            // 같은 사람이 스무 번 들락거린 것과 스무 명이 한 번씩 본 것은
                            // 전혀 다른 이야기다. 횟수만 세면 둘이 같아 보인다.
                            m.put("visitors", num(r[3]));
                            return m;
                        })
                .toList();
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
    /**
     * C-3 — 세션 기준 방문 요약. "몇 명 왔나" 옆에 "다시 오나" 를 놓는다.
     *
     * <p>수집은 이미 되고 있었다({@code visit_event.session_id}). 읽는 곳이 없었을 뿐이라 새로
     * 쌓을 것은 없고 집계만 한다.
     *
     * <p><b>{@code truncated} 를 함께 돌려주는 이유.</b> 재방문 판정은 보관기간 안에서만 가능하다.
     * 90일 보관인데 120일 구간을 물으면 앞쪽 30일은 비교할 과거가 없어 그 사람들이 전부 신규로
     * 잡힌다. 그 사실을 값에 담지 않으면 <b>화면은 멀쩡해 보이는데 숫자만 틀린다</b> — 보는 사람이
     * 알 방법이 없다. 그래서 "이 구간은 잘렸다" 를 같이 내보낸다.
     *
     * @param days 조회할 최근 일수. 1 미만이면 1 로 올린다
     */
    @Transactional(readOnly = true)
    public SessionStatsDto getSessionStats(int days) {
        int safeDays = Math.max(1, days);
        LocalDateTime to = LocalDateTime.now();
        LocalDateTime from = to.minusDays(safeDays);

        Object[] totals = visitEventRepository.sessionTotals(from, to);
        long sessions = asLong(totals, 0);
        long visitors = asLong(totals, 1);
        long events = asLong(totals, 2);
        long returning = visitEventRepository.countReturningVisitors(from, to);

        int safeRetentionDays = Math.max(1, retentionDays);
        return SessionStatsDto.of(
                sessions, visitors, events, returning, safeRetentionDays,
                safeDays >= safeRetentionDays);
    }

    /**
     * 네이티브 집계 한 줄에서 값을 꺼낸다.
     *
     * <p>드라이버·하이버네이트 조합에 따라 결과가 {@code Object[]} 한 줄로 오기도 하고 그것을 감싼
     * {@code Object[][]} 로 오기도 한다. 둘 다 받아 준다 — 여기서 ClassCastException 이 나면 관리자
     * 화면 전체가 500 이 된다.
     */
    private static long asLong(Object[] row, int index) {
        if (row == null) return 0;
        Object[] cells = (row.length == 1 && row[0] instanceof Object[] inner) ? inner : row;
        if (index >= cells.length || cells[index] == null) return 0;
        return ((Number) cells[index]).longValue();
    }

    @Scheduled(cron = "${popspot.visit-log.cleanup-cron:0 40 4 * * *}", zone = "Asia/Seoul")
    @Transactional
    public void deleteExpiredVisitLogs() {
        int safeRetentionDays = Math.max(1, retentionDays);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(safeRetentionDays);
        int deleted = visitLogRepository.deleteByCreatedAtBefore(cutoff);
        // 행동 기록도 같은 기준으로 지운다. 따로 두면 한쪽만 정리돼 방침의 90일 약속이
        // 반만 지켜진다 — 그 어긋남은 아무 데도 드러나지 않는다.
        int deletedEvents = visitEventRepository.deleteOlderThan(cutoff);
        if (deleted > 0 || deletedEvents > 0) {
            log.info(
                    "[VisitLog] 보관기간 초과 삭제 방문={} 행동={} retentionDays={}",
                    deleted,
                    deletedEvents,
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
