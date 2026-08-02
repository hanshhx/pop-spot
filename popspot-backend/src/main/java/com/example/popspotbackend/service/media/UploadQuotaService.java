package com.example.popspotbackend.service.media;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 계정당 하루 업로드 한도.
 *
 * <p><b>왜 계정 기준인가.</b> 아바타·채팅 이미지 업로드는 프론트가 백엔드를 <b>직접</b> 부른다(api.ts 의 FORCE_ABSOLUTE_PREFIXES —
 * 프록시를 태우면 응답 URL 이 popspot.co.kr 로 나와 404 가 된다). 그 경로에는 엣지 서명이 안 붙어 IP 가 {@code remoteAddr} 로
 * 강등되므로 <b>IP 로는 사람을 구분할 수 없다.</b> 업로드는 이미 로그인을 요구하니 계정으로 세는 것이 정확하다.
 *
 * <p><b>왜 필요한가.</b> 지금까지 업로드에는 총량 제한이 없었다. 파일 하나당 크기만 막혀 있어서 계정 하나가 반복 업로드로 디스크를 채울 수 있었다. 디스크가 차면
 * 업로드만 죽는 게 아니라 DB 와 로그까지 같이 멈춘다.
 *
 * <p><b>Redis 를 쓰는 이유.</b> 메모리에 세면 재시작마다 초기화돼 한도가 사실상 없는 것과 같다. 키는 날짜를 포함하고 그날 자정에 만료되므로 따로 청소할 것이
 * 없다.
 *
 * <p><b>Redis 가 죽으면 통과시킨다.</b> 업로드는 사용자가 쓰는 정상 기능이고, 이 한도는 남용을 막는 보조 장치다. 카운터를 못 읽는다고 멀쩡한 사용자의 업로드를
 * 막으면 손해가 더 크다. 대신 로그를 남겨 남용이 의심될 때 확인할 수 있게 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UploadQuotaService {

    private static final String KEY_PREFIX = "upload:quota:";
    private static final String SUFFIX_BYTES = ":bytes";
    private static final String SUFFIX_COUNT = ":count";

    /** 날짜 경계는 한국 시간 기준. 서버는 UTC 라 그냥 두면 오전 9시에 하루가 바뀐다. */
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private static final long BYTES_PER_MB = 1024L * 1024L;

    private final StringRedisTemplate redis;

    @Value("${app.upload.daily-mb:20}")
    private int dailyMb;

    @Value("${app.upload.daily-count:30}")
    private int dailyCount;

    /** 한도 판정 결과. 막을 때는 사용자에게 보여 줄 이유가 함께 온다. */
    public record Decision(boolean allowed, String reason) {
        static Decision ok() {
            return new Decision(true, null);
        }

        static Decision denied(String reason) {
            return new Decision(false, reason);
        }
    }

    /**
     * 이 업로드를 받아도 되는지. <b>아직 세지는 않는다</b> — 저장에 성공한 뒤 {@link #record} 를 부른다.
     *
     * <p>순서를 나눈 이유는 검증에 걸려 저장되지 않은 파일까지 한도를 깎으면 안 되기 때문이다. 이미지가 아니거나 손상돼 거부된 요청으로 하루치를 소진시킬 수 있다.
     */
    public Decision check(String userId, long incomingBytes) {
        if (userId == null || userId.isBlank()) return Decision.ok();

        try {
            long usedBytes = readLong(key(userId, SUFFIX_BYTES));
            long usedCount = readLong(key(userId, SUFFIX_COUNT));

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
            // 카운터를 못 읽는다고 정상 업로드를 막지 않는다.
            log.warn("[UploadQuota] 사용량 조회 실패 — 통과시킨다: {}", e.getClass().getSimpleName());
            return Decision.ok();
        }
    }

    /** 저장에 성공한 업로드를 사용량에 더한다. */
    public void record(String userId, long bytes) {
        if (userId == null || userId.isBlank()) return;

        try {
            Duration ttl = untilMidnightKst();
            increment(key(userId, SUFFIX_BYTES), bytes, ttl);
            increment(key(userId, SUFFIX_COUNT), 1, ttl);
        } catch (RuntimeException e) {
            log.warn("[UploadQuota] 사용량 기록 실패: {}", e.getClass().getSimpleName());
        }
    }

    private void increment(String key, long delta, Duration ttl) {
        Long after = redis.opsForValue().increment(key, delta);
        // 처음 만들어진 키에만 만료를 건다. 매번 걸면 하루 종일 만료가 밀려 영원히 안 지워진다.
        if (after != null && after == delta) redis.expire(key, ttl);
    }

    private long readLong(String key) {
        String raw = redis.opsForValue().get(key);
        if (raw == null) return 0L;
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private String key(String userId, String suffix) {
        return KEY_PREFIX + userId + ":" + LocalDate.now(KST) + suffix;
    }

    /** 오늘 자정(KST)까지 남은 시간. 0 이 되지 않도록 최소 1분을 보장한다. */
    private Duration untilMidnightKst() {
        LocalDateTime now = LocalDateTime.now(KST);
        LocalDateTime midnight = now.toLocalDate().plusDays(1).atStartOfDay();
        Duration remaining = Duration.between(now, midnight);
        return remaining.isNegative() || remaining.toMinutes() < 1
                ? Duration.ofMinutes(1)
                : remaining;
    }
}
