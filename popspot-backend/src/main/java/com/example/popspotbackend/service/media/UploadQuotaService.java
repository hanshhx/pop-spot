package com.example.popspotbackend.service.media;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

/** 계정당 하루 업로드 개수·용량을 원자적으로 제한한다. */
@Slf4j
@Service
@RequiredArgsConstructor
public class UploadQuotaService {

    private static final String KEY_PREFIX = "upload:quota:";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final long BYTES_PER_MB = 1024L * 1024L;

    /**
     * 확인과 사용량 증가를 Redis 안에서 한 번에 수행한다.
     *
     * <p>조회한 뒤 파일을 저장하고 나중에 증가시키면 동시 요청 여러 개가 모두 같은 옛 사용량을 보고 통과할 수 있다. Lua 스크립트 한 번으로 묶어야 서버가 여러
     * 대여도 하루 한도를 넘지 않는다.
     */
    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> RESERVE_SCRIPT =
            new DefaultRedisScript<>(
                    "local usedBytes = tonumber(redis.call('HGET', KEYS[1], 'bytes') or '0') "
                            + "local usedCount = tonumber(redis.call('HGET', KEYS[1], 'count') or '0') "
                            + "local incoming = tonumber(ARGV[1]) "
                            + "local maxBytes = tonumber(ARGV[2]) "
                            + "local maxCount = tonumber(ARGV[3]) "
                            + "if usedCount + 1 > maxCount then return {0, usedBytes, usedCount, 1} end "
                            + "if usedBytes + incoming > maxBytes then return {0, usedBytes, usedCount, 2} end "
                            + "local nextBytes = redis.call('HINCRBY', KEYS[1], 'bytes', incoming) "
                            + "local nextCount = redis.call('HINCRBY', KEYS[1], 'count', 1) "
                            + "if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[4]) end "
                            + "return {1, nextBytes, nextCount, 0}",
                    List.class);

    /** 저장 실패 시 앞서 잡아 둔 몫을 되돌린다. 값이 음수가 되지 않게 Redis 안에서 계산한다. */
    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> RELEASE_SCRIPT =
            new DefaultRedisScript<>(
                    "local usedBytes = tonumber(redis.call('HGET', KEYS[1], 'bytes') or '0') "
                            + "local usedCount = tonumber(redis.call('HGET', KEYS[1], 'count') or '0') "
                            + "local nextBytes = math.max(0, usedBytes - tonumber(ARGV[1])) "
                            + "local nextCount = math.max(0, usedCount - 1) "
                            + "if nextBytes == 0 and nextCount == 0 then "
                            + "redis.call('DEL', KEYS[1]) "
                            + "else "
                            + "redis.call('HSET', KEYS[1], 'bytes', nextBytes, 'count', nextCount) "
                            + "end "
                            + "return {nextBytes, nextCount}",
                    List.class);

    private final StringRedisTemplate redis;

    @Value("${app.upload.daily-mb:20}")
    private int dailyMb;

    @Value("${app.upload.daily-count:30}")
    private int dailyCount;

    /** 임시 장애는 일반 한도 초과와 구분해 컨트롤러가 503으로 응답한다. */
    public record Decision(boolean allowed, boolean temporarilyUnavailable, String reason) {
        static Decision ok() {
            return new Decision(true, false, null);
        }

        static Decision denied(String reason) {
            return new Decision(false, false, reason);
        }

        static Decision unavailable() {
            return new Decision(false, true, "업로드 보호 시스템을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    /** 검증을 마친 파일이 차지할 몫을 먼저 잡는다. 성공한 요청만 파일 저장 단계로 진행할 수 있다. */
    @SuppressWarnings("unchecked")
    public Decision reserve(String userId, long incomingBytes) {
        if (userId == null || userId.isBlank() || incomingBytes <= 0) {
            log.warn("[UploadQuota] 잘못된 예약 요청 거부");
            return Decision.unavailable();
        }

        long limitBytes = dailyMb * BYTES_PER_MB;
        try {
            List<Long> result =
                    (List<Long>)
                            redis.execute(
                                    RESERVE_SCRIPT,
                                    List.of(key(userId)),
                                    incomingBytes,
                                    limitBytes,
                                    dailyCount,
                                    Math.max(60, untilMidnightKst().toSeconds()));
            if (result == null || result.size() < 4) {
                log.error("[UploadQuota] Redis 예약 결과가 비어 있거나 손상됨");
                return Decision.unavailable();
            }
            if (result.get(0) == 1L) return Decision.ok();

            long reasonCode = result.get(3);
            if (reasonCode == 1L) {
                return Decision.denied(
                        "오늘 올릴 수 있는 파일 수(" + dailyCount + "개)를 다 썼어요. 내일 다시 시도해 주세요.");
            }
            if (reasonCode == 2L) {
                long remainMb = Math.max(0, (limitBytes - result.get(1)) / BYTES_PER_MB);
                return Decision.denied(
                        "오늘 올릴 수 있는 용량(" + dailyMb + "MB)을 넘었어요. 남은 용량 " + remainMb + "MB.");
            }
            log.error("[UploadQuota] 알 수 없는 Redis 예약 결과 code={}", reasonCode);
            return Decision.unavailable();
        } catch (RuntimeException e) {
            log.error("[UploadQuota] Redis 예약 실패 — 업로드를 안전하게 차단: {}", e.getClass().getSimpleName());
            return Decision.unavailable();
        }
    }

    /**
     * 폐기 예정인 기존 채팅 업로드 경로의 호환용 판정 API.
     *
     * <p>신규 업로드 경로는 동시 요청에도 안전한 {@link #reserve}를 사용한다. 이 메서드는 해당 기능을 건드리지 않기 위해 기존 호출 계약만 보존한다.
     */
    public Decision check(String userId, long incomingBytes) {
        if (userId == null || userId.isBlank()) return Decision.ok();
        try {
            long usedBytes = readHashLong(key(userId), "bytes");
            long usedCount = readHashLong(key(userId), "count");
            if (usedCount + 1 > dailyCount) {
                return Decision.denied(
                        "오늘 올릴 수 있는 파일 수(" + dailyCount + "개)를 다 썼어요. 내일 다시 시도해 주세요.");
            }
            long limitBytes = dailyMb * BYTES_PER_MB;
            if (usedBytes + incomingBytes > limitBytes) {
                long remainMb = Math.max(0, (limitBytes - usedBytes) / BYTES_PER_MB);
                return Decision.denied(
                        "오늘 올릴 수 있는 용량(" + dailyMb + "MB)을 넘었어요. 남은 용량 " + remainMb + "MB.");
            }
            return Decision.ok();
        } catch (RuntimeException e) {
            log.warn("[UploadQuota] 호환 경로 사용량 조회 실패: {}", e.getClass().getSimpleName());
            return Decision.ok();
        }
    }

    /** 폐기 예정인 기존 채팅 업로드 경로의 호환용 기록 API. */
    public void record(String userId, long bytes) {
        if (userId == null || userId.isBlank() || bytes <= 0) return;
        try {
            String key = key(userId);
            redis.opsForHash().increment(key, "bytes", bytes);
            redis.opsForHash().increment(key, "count", 1);
            if (Boolean.FALSE.equals(redis.hasKey(key)) || redis.getExpire(key) < 0) {
                redis.expire(key, untilMidnightKst());
            }
        } catch (RuntimeException e) {
            log.warn("[UploadQuota] 호환 경로 사용량 기록 실패: {}", e.getClass().getSimpleName());
        }
    }

    /** 파일 저장이나 DB 반영이 실패했을 때만 호출한다. 성공한 업로드 몫은 자정까지 유지한다. */
    public void release(String userId, long bytes) {
        if (userId == null || userId.isBlank() || bytes <= 0) return;
        try {
            redis.execute(RELEASE_SCRIPT, List.of(key(userId)), bytes);
        } catch (RuntimeException e) {
            // 실제 파일은 저장되지 않았으므로 디스크 고갈 위험은 없다. 한도가 조금 엄격해지는 쪽으로 실패한다.
            log.warn("[UploadQuota] 실패한 업로드 예약 해제 실패: {}", e.getClass().getSimpleName());
        }
    }

    private String key(String userId) {
        return KEY_PREFIX + userId + ":" + LocalDate.now(KST);
    }

    private long readHashLong(String key, String field) {
        Object raw = redis.opsForHash().get(key, field);
        if (raw == null) return 0L;
        try {
            return Long.parseLong(raw.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private Duration untilMidnightKst() {
        LocalDateTime now = LocalDateTime.now(KST);
        LocalDateTime midnight = now.toLocalDate().plusDays(1).atStartOfDay();
        Duration remaining = Duration.between(now, midnight);
        return remaining.isNegative() || remaining.toMinutes() < 1
                ? Duration.ofMinutes(1)
                : remaining;
    }
}
