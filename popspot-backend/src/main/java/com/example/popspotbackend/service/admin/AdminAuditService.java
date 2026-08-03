package com.example.popspotbackend.service.admin;

import com.example.popspotbackend.entity.AdminAuditLog;
import com.example.popspotbackend.repository.AdminAuditLogRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 감사 로그 기록.
 *
 * <p><b>기록 실패가 본래 작업을 망치면 안 된다.</b> 감사 로그는 곁다리다. DB 가 잠깐 흔들린다고 팝업 승인이 실패하면, 있으나 마나 한 기능을 위해 서비스를
 * 망가뜨리는 셈이 된다. 그래서 예외를 삼킨다 — 대신 <b>누가 무엇을 하다 놓쳤는지</b>까지 로그에 남긴다. 삼키기만 하고 흔적이 없으면 기록이 비어도 아무도 모른다.
 *
 * <p><b>{@code REQUIRES_NEW} 인 이유.</b> 관리자 작업이 실패해 롤백되면 같은 트랜잭션에 있던 감사 기록도 함께 사라진다. 실패야말로 남아야 하는
 * 기록인데 그게 지워지면 안 된다. 별도 트랜잭션으로 떼어 놓아야 본체가 롤백돼도 기록은 남는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuditService {

    /**
     * 권한 거부(403) 기록의 계정당 최소 간격.
     *
     * <p>403 은 <b>요청 제한의 사각지대</b>다. {@code /api/admin/**} 의 권한 거부는 Spring Security 필터가
     * DispatcherServlet 앞에서 끊는데, 요청 제한 장치는 그 안쪽의 MVC 인터셉터라 여기까지 도달하지 못한다. 그대로 두면 로그인한 일반 회원 한 명이
     * 관리자 주소를 반복 호출해 이 표를 무한히 부풀릴 수 있다 — 감사 로그를 채우는 것 자체가 공격이 된다.
     *
     * <p>조사에 필요한 것은 "이 계정이 관리자 영역을 건드렸다" 는 사실과 규모지, 시도 1건마다의 행이 아니다. 계정당 이 간격에 한 줄만 남기고, 그 사이 시도
     * 횟수는 다음 기록의 {@code detail} 에 합산한다. 횟수를 잃지 않으면서 행 수는 분당 1로 묶인다.
     */
    private static final long DENIED_INTERVAL_MS = Duration.ofMinutes(1).toMillis();

    /** 억제 상태 보관 기간. 기록 간격보다 넉넉해야 그사이 누적 횟수가 유실되지 않는다. */
    private static final Duration DENIED_CACHE_TTL = Duration.ofMinutes(30);

    private static final int DENIED_CACHE_MAX = 10_000;

    /**
     * 대상 식별자로 허용하는 형식 — 숫자 id 또는 UUID.
     *
     * <p>경로 변수는 결국 <b>사용자가 보낸 문자열</b>이다. Spring 은 타입 변환 전에 그 값을 채워 두므로, 검사 없이 저장하면 {@code
     * /api/admin/users/someone@example.com} 같은 요청의 이메일이 그대로 감사 표에 박힌다. "대상은 내부 식별자로만" 이라는 이 표의 핵심
     * 약속은 코드로 강제하지 않으면 약속이 아니다.
     */
    private static final Pattern SAFE_TARGET_ID =
            Pattern.compile(
                    "^[0-9]{1,19}$"
                            + "|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}"
                            + "-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private static final int ACTOR_MAX = 64;
    private static final int ACTION_MAX = 120;
    private static final int TARGET_TYPE_MAX = 30;
    private static final int DETAIL_MAX = 200;
    private static final int ACTOR_IP_MAX = 45;

    private final AdminAuditLogRepository repository;

    /**
     * 권한 거부 억제 상태 — 계정 → {@code [누적 시도, 마지막 기록 시각]}.
     *
     * <p>메모리에만 둔다. 재시작하면 초기화되지만 그래 봐야 계정당 한 줄이 더 생길 뿐이라 문제가 되지 않는다.
     */
    private final Cache<String, long[]> deniedState =
            Caffeine.newBuilder()
                    .maximumSize(DENIED_CACHE_MAX)
                    .expireAfterWrite(DENIED_CACHE_TTL)
                    .build();

    /** 기록 한 건 — 접속지 없이(스케줄러 등 사람이 아닌 주체). */
    public void record(
            String actorId,
            String action,
            String targetType,
            String targetId,
            boolean success,
            Integer statusCode,
            String detail) {
        record(actorId, action, targetType, targetId, success, statusCode, detail, null);
    }

    /** 기록 한 건. 실패해도 예외를 밖으로 내보내지 않는다. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            String actorId,
            String action,
            String targetType,
            String targetId,
            boolean success,
            Integer statusCode,
            String detail,
            String actorIp) {
        try {
            repository.save(
                    AdminAuditLog.builder()
                            .actorId(clamp(actorId, ACTOR_MAX))
                            .action(clamp(action, ACTION_MAX))
                            .targetType(clamp(targetType, TARGET_TYPE_MAX))
                            .targetId(safeTargetId(targetId))
                            .success(success)
                            .statusCode(statusCode == null ? null : statusCode.shortValue())
                            .detail(clamp(detail, DETAIL_MAX))
                            .actorIp(clamp(actorIp, ACTOR_IP_MAX))
                            .build());
        } catch (RuntimeException e) {
            // 여기서 '누가' 를 버리면 안 된다. 감사 로그가 답해야 할 첫 질문이 그것인데,
            // 마지막 방어선인 이 로그가 그 필드를 빠뜨리면 기록이 통째로 없는 것과 같아진다.
            log.error(
                    "[감사로그] 기록 실패 — actorId={} action={} targetType={} targetId={} status={} 원인={}",
                    actorId,
                    action,
                    targetType,
                    targetId,
                    statusCode,
                    e.getClass().getSimpleName());
        }
    }

    /**
     * 기록에 실패하면 <b>예외를 던진다.</b> 개인정보 해제처럼 "기록이 남는다는 것" 자체가 존재 이유인 동작에만 쓴다.
     *
     * <p>{@link #record} 는 실패를 삼킨다 — 감사 기록 때문에 팝업 승인이 실패하면 곁다리가 본체를 망치는 것이라 그 판단이 맞다. 하지만 해제는 다르다.
     * 기록이 실패했는데 이메일은 나가는 조합이 <b>가장 나쁜 결과</b>다: 유출은 일어났고 흔적은 없다. 그럴 바에는 해제를 거절하는 편이 낫다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOrThrow(
            String actorId,
            String action,
            String targetType,
            String targetId,
            boolean success,
            Integer statusCode,
            String detail) {
        repository.save(
                AdminAuditLog.builder()
                        .actorId(clamp(actorId, ACTOR_MAX))
                        .action(clamp(action, ACTION_MAX))
                        .targetType(clamp(targetType, TARGET_TYPE_MAX))
                        .targetId(safeTargetId(targetId))
                        .success(success)
                        .statusCode(statusCode == null ? null : statusCode.shortValue())
                        .detail(clamp(detail, DETAIL_MAX))
                        .build());
    }

    /** 권한 거부(403). 계정당 {@link #DENIED_INTERVAL_MS} 에 한 줄로 접고, 억제된 횟수는 다음 기록에 합산한다. */
    public void recordAccessDenied(String actorId, String action) {
        String key = actorId == null || actorId.isBlank() ? "(anonymous)" : actorId;
        long now = System.currentTimeMillis();

        long[] state = deniedState.get(key, k -> new long[] {0, 0});
        long attempts;
        synchronized (state) {
            state[0]++;
            if (now - state[1] < DENIED_INTERVAL_MS) return; // 억제 — 횟수만 누적된다
            attempts = state[0];
            state[0] = 0;
            state[1] = now;
        }

        record(
                key,
                action,
                AdminAuditLog.TARGET_SYSTEM,
                null,
                false,
                403,
                attempts > 1 ? "권한없음 attempts=" + attempts : "권한없음");
    }

    /** 형식에 맞지 않으면 저장하지 않는다 — 이메일·임의 문자열이 새는 경로를 막는다. */
    private String safeTargetId(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String trimmed = raw.trim();
        return SAFE_TARGET_ID.matcher(trimmed).matches() ? trimmed : null;
    }

    /**
     * 길이 자르기 — <b>문자 경계</b>에서 자른다.
     *
     * <p>그냥 잘라 내면 이모지처럼 두 칸을 차지하는 문자가 반으로 쪼개져 짝 없는 조각이 남고, PostgreSQL 이 그 문자열을 거부해 기록 자체가 실패한다.
     * 공격자가 파라미터 끝에 이모지 하나를 붙이는 것만으로 자기 흔적을 지울 수 있다는 뜻이다.
     */
    private String clamp(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.length() <= max) return trimmed;

        int end = max;
        if (Character.isLowSurrogate(trimmed.charAt(end))) end--;
        return trimmed.substring(0, end);
    }
}
