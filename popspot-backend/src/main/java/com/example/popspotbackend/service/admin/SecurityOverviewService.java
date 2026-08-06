package com.example.popspotbackend.service.admin;

import com.example.popspotbackend.dto.SecurityOverviewDto;
import com.example.popspotbackend.entity.AdminAuditLog;
import com.example.popspotbackend.repository.AdminAuditLogRepository;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * D-1 — 감사 로그를 보안 현황판 한 장으로 요약한다.
 *
 * <p>새로 쌓는 것은 없다. B-4 에서 이미 남기고 있던 것을 <b>읽는 창구가 없어서</b> 목록을 한 줄씩 넘겨보는 것 말고는 볼 방법이 없었다.
 */
@Service
@RequiredArgsConstructor
public class SecurityOverviewService {

    /** 목록으로 보여 줄 최근 건수. 현황판은 훑는 자리라 길면 오히려 안 읽힌다. */
    private static final int RECENT_LIMIT = 10;

    private final AdminAuditLogRepository auditRepository;

    /**
     * @param days 최근 며칠. 1 미만이면 1, 90 을 넘기면 90 으로 자른다 — 감사 로그도 보관 한도가 있어 그 밖을 물어봐야 나올 것이 없다
     */
    @Transactional(readOnly = true)
    public SecurityOverviewDto get(int days) {
        int safeDays = Math.min(Math.max(days, 1), 90);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime since = now.minusDays(safeDays);

        long total = auditRepository.countByCreatedAtGreaterThanEqual(since);
        long failed = auditRepository.countBySuccessFalseAndCreatedAtGreaterThanEqual(since);

        List<SecurityOverviewDto.TargetCount> byTarget =
                auditRepository.countByTargetSince(since).stream()
                        .map(
                                r ->
                                        new SecurityOverviewDto.TargetCount(
                                                (String) r[0], ((Number) r[1]).longValue()))
                        .toList();

        /*
         * "처음 보는 IP" 는 직전 같은 길이의 구간과 비교해서 낸다.
         *
         * 전체 기간과 비교하면 오래 전에 한 번 쓴 IP 도 "아는 IP" 가 되어 경고가 무뎌지고,
         * 반대로 구간을 너무 짧게 잡으면 매일 같은 IP 가 새 IP 로 잡힌다. 같은 길이로 맞춰
         * 두면 "요즘 안 쓰던 곳" 이라는 뜻이 된다.
         */
        Set<String> before =
                new HashSet<>(auditRepository.distinctIpsBetween(since.minusDays(safeDays), since));
        List<String> newIps =
                auditRepository.distinctIpsBetween(since, now).stream()
                        .filter(ip -> !before.contains(ip))
                        .map(SecurityOverviewService::maskIp)
                        .toList();
        int knownIpCount = (int) before.size();

        var page = PageRequest.of(0, RECENT_LIMIT);
        return new SecurityOverviewDto(
                safeDays,
                total,
                failed,
                SecurityOverviewDto.rate(failed, total),
                byTarget,
                newIps,
                knownIpCount,
                auditRepository.countByActorIpIsNullAndCreatedAtGreaterThanEqual(since),
                auditRepository.destructiveSince(since, page).stream()
                        .map(SecurityOverviewService::toEntry)
                        .toList(),
                auditRepository
                        .byTargetSince(since, AdminAuditLog.TARGET_MEMBER_DATA, page)
                        .stream()
                        .map(SecurityOverviewService::toEntry)
                        .toList());
    }

    private static SecurityOverviewDto.Entry toEntry(AdminAuditLog a) {
        return new SecurityOverviewDto.Entry(
                a.getCreatedAt() == null ? "" : a.getCreatedAt().toString(),
                a.getActorId(),
                a.getAction(),
                a.getTargetType(),
                maskIp(a.getActorIp()));
    }

    /**
     * IP 를 가린다 — {@code 1.2.3.4 → 1.2.3.*}.
     *
     * <p>현황판이 답해야 하는 것은 "낯선 곳인가" 이지 "어느 집인가" 가 아니다. 온전한 주소는 감사 로그 원본에 있으므로, 요약 화면까지 평문으로 복제하면 <b>같은
     * 개인정보를 보관하는 자리만 하나 더 늘어난다.</b>
     *
     * <p>앞 세 덩이를 남기는 이유는 그래야 "처음 보는 IP" 판정이 사람 눈에도 이어지기 때문이다 — 전부 가리면 새 IP 가 몇 개든 다 똑같아 보인다. 판정 자체는
     * 가리기 <b>전</b> 값으로 한다.
     */
    static String maskIp(String ip) {
        if (ip == null || ip.isBlank()) return "";
        int lastDot = ip.lastIndexOf('.');
        if (lastDot > 0) return ip.substring(0, lastDot) + ".*";
        // IPv6 등 점이 없는 형태 — 앞부분만 남긴다.
        int lastColon = ip.lastIndexOf(':');
        return lastColon > 0 ? ip.substring(0, lastColon) + ":*" : "*";
    }
}
