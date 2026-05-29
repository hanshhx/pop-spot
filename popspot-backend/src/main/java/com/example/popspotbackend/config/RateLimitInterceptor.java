package com.example.popspotbackend.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 로그인 / 이메일 발송 / 인증코드 검증 같은 민감 엔드포인트의 IP 기반 Rate Limit.
 *
 * <p>로그인은 IP 별 분당 5회, 이메일 발송은 시간당 5회, 코드 검증은 분당 10회를 허용한다. 메모리 기반이므로 단일 인스턴스 가정이고, 멀티 인스턴스 환경에서는
 * Redis 백엔드로 교체가 필요하다.
 */
@Slf4j
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final String PATH_LOGIN = "/api/v1/auth/login";
    private static final String PATH_EMAIL_SEND = "/api/v1/auth/email/send";
    private static final String PATH_EMAIL_SEND_FOR_PW = "/api/v1/auth/email/send-for-pw";
    private static final String PATH_EMAIL_VERIFY = "/api/v1/auth/email/verify";
    // v2.22 — 이메일 열거(enumeration) 차단용 GET 엔드포인트.
    private static final String PATH_CHECK_EMAIL = "/api/v1/auth/check-email";
    private static final String PATH_FIND_EMAIL = "/api/v1/auth/find-email";

    private static final int LIMIT_LOGIN_PER_MIN = 5;
    private static final int LIMIT_EMAIL_PER_HOUR = 5;
    private static final int LIMIT_VERIFY_PER_MIN = 10;
    private static final int LIMIT_ENUM_PER_MIN = 20;

    private static final String RATE_LIMIT_BODY =
            "{\"error\":\"RATE_LIMITED\",\"message\":\"요청이 너무 많습니다. 잠시 후 다시 시도하세요.\"}";

    private static final long MAX_BUCKETS = 100_000;

    // 보안(v2.22): 기존 ConcurrentHashMap 은 (URI|IP) 키가 무한 증가했다. X-Forwarded-For 위조로
    // 고유 키를 무한 생성하면 메모리 고갈(OOM). Caffeine 으로 최대 크기 + 1시간 미사용 만료를 둬
    // 메모리 상한을 보장한다.
    private final Cache<String, Bucket> buckets =
            Caffeine.newBuilder()
                    .maximumSize(MAX_BUCKETS)
                    .expireAfterAccess(Duration.ofHours(1))
                    .build();

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        // v2.22 — GET 열거 엔드포인트도 제한하므로 메서드로 거르지 않고 URI 로만 판단한다.
        // 제한 대상이 아닌 경로는 resolveLimit 가 null 을 반환해 그대로 통과한다.
        Bandwidth limit = resolveLimit(request.getRequestURI());
        if (limit == null) return true;

        String key = request.getRequestURI() + "|" + clientIp(request);
        Bucket bucket = buckets.get(key, k -> Bucket.builder().addLimit(limit).build());

        if (bucket.tryConsume(1)) return true;

        rejectAsRateLimited(request, response);
        return false;
    }

    private Bandwidth resolveLimit(String uri) {
        return switch (uri) {
            case PATH_LOGIN -> Bandwidth.classic(
                    LIMIT_LOGIN_PER_MIN,
                    Refill.intervally(LIMIT_LOGIN_PER_MIN, Duration.ofMinutes(1)));
            case PATH_EMAIL_SEND, PATH_EMAIL_SEND_FOR_PW -> Bandwidth.classic(
                    LIMIT_EMAIL_PER_HOUR,
                    Refill.intervally(LIMIT_EMAIL_PER_HOUR, Duration.ofHours(1)));
            case PATH_EMAIL_VERIFY -> Bandwidth.classic(
                    LIMIT_VERIFY_PER_MIN,
                    Refill.intervally(LIMIT_VERIFY_PER_MIN, Duration.ofMinutes(1)));
            case PATH_CHECK_EMAIL, PATH_FIND_EMAIL -> Bandwidth.classic(
                    LIMIT_ENUM_PER_MIN,
                    Refill.intervally(LIMIT_ENUM_PER_MIN, Duration.ofMinutes(1)));
            default -> null;
        };
    }

    private void rejectAsRateLimited(HttpServletRequest request, HttpServletResponse response)
            throws java.io.IOException {
        log.warn("RateLimit exceeded uri={} ip={}", request.getRequestURI(), clientIp(request));
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(RATE_LIMIT_BODY);
    }

    /** X-Forwarded-For / X-Real-IP 헤더 우선. 둘 다 없으면 remote addr. */
    private String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real;
        return req.getRemoteAddr();
    }
}
