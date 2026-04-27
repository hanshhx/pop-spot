package com.example.popspotbackend.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 / 이메일 발송 / 인증코드 검증 등 민감 엔드포인트에 IP 기반 Rate Limit.
 *
 * 정책:
 *   POST /api/v1/auth/login                 → IP별 분당 5회
 *   POST /api/v1/auth/email/send            → IP별 분당 1회, 시간당 5회
 *   POST /api/v1/auth/email/send-for-pw     → 위와 동일
 *   POST /api/v1/auth/email/verify          → IP별 분당 10회
 *
 * 메모리 기반(인스턴스 1개 가정). 멀티 인스턴스로 가면 Redis 백엔드 권장.
 */
@Slf4j
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String uri = request.getRequestURI();
        String method = request.getMethod();

        if (!"POST".equalsIgnoreCase(method)) return true;

        Bandwidth limit = resolveLimit(uri);
        if (limit == null) return true;

        String key = uri + "|" + clientIp(request);
        Bucket bucket = buckets.computeIfAbsent(key, k -> Bucket.builder().addLimit(limit).build());

        if (bucket.tryConsume(1)) {
            return true;
        }

        log.warn("⛔ RateLimit exceeded uri={} ip={}", uri, clientIp(request));
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"RATE_LIMITED\",\"message\":\"요청이 너무 많습니다. 잠시 후 다시 시도하세요.\"}");
        return false;
    }

    private Bandwidth resolveLimit(String uri) {
        if (uri.equals("/api/v1/auth/login")) {
            return Bandwidth.classic(5, io.github.bucket4j.Refill.intervally(5, Duration.ofMinutes(1)));
        }
        if (uri.equals("/api/v1/auth/email/send") || uri.equals("/api/v1/auth/email/send-for-pw")) {
            return Bandwidth.classic(5, io.github.bucket4j.Refill.intervally(5, Duration.ofHours(1)));
        }
        if (uri.equals("/api/v1/auth/email/verify")) {
            return Bandwidth.classic(10, io.github.bucket4j.Refill.intervally(10, Duration.ofMinutes(1)));
        }
        return null;
    }

    private String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real;
        return req.getRemoteAddr();
    }
}
