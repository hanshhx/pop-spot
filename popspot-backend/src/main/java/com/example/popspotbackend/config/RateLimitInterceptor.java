package com.example.popspotbackend.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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

    private static final int LIMIT_LOGIN_PER_MIN = 5;
    private static final int LIMIT_EMAIL_PER_HOUR = 5;
    private static final int LIMIT_VERIFY_PER_MIN = 10;

    private static final String RATE_LIMIT_BODY =
            "{\"error\":\"RATE_LIMITED\",\"message\":\"요청이 너무 많습니다. 잠시 후 다시 시도하세요.\"}";

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;

        Bandwidth limit = resolveLimit(request.getRequestURI());
        if (limit == null) return true;

        String key = request.getRequestURI() + "|" + clientIp(request);
        Bucket bucket = buckets.computeIfAbsent(key, k -> Bucket.builder().addLimit(limit).build());

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
