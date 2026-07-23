package com.example.popspotbackend.config;

import com.example.popspotbackend.controller.PopupStoreController;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
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

    /**
     * 권리자 takedown 신고 핸들러 메서드명 — {@link PopupStoreController#requestTakedown}.
     *
     * <p>이 엔드포인트는 인증 없이 호출 가능하지만 즉시 숨기지 않고 관리자 검토 큐에 넣는다. 호출 빈도 제한은 검토 큐 스팸을 막는 추가 방어선이다.
     */
    private static final String TAKEDOWN_METHOD_NAME = "requestTakedown";

    /**
     * takedown 전용 버킷 이름.
     *
     * <p>버킷 키를 URI 로 잡으면 팝업마다 키가 달라져 "팝업 1건당 3회" 가 된다. 공격자는 서로 다른 팝업 1000개를 각각 1회씩 내려버리면 그만이라 제한이
     * 검토 큐를 스팸으로 채울 수 있다. 기능 단위로 묶어 IP 당 총량을 센다.
     */
    private static final String BUCKET_TAKEDOWN = "takedown";

    private static final int LIMIT_LOGIN_PER_MIN = 5;
    private static final int LIMIT_EMAIL_PER_HOUR = 5;
    private static final int LIMIT_VERIFY_PER_MIN = 10;
    private static final int LIMIT_ENUM_PER_MIN = 20;
    private static final int LIMIT_TAKEDOWN_PER_HOUR = 3;
    private static final int LIMIT_GAME_START_PER_MIN = 3;
    private static final int LIMIT_GENERAL_PER_MIN = 60;

    @Value("${app.trust-proxy-headers:false}")
    private boolean trustProxyHeaders;

    /**
     * 경로를 알아보지 못했을 때 적용할 보수적 기본값.
     *
     * <p>이 인터셉터는 등록된 민감 경로에서만 호출된다. 그런데도 {@code resolveLimit} 가 못 알아봤다는 건 인코딩 우회 같은 변형 표기일 개연성이
     * 높다(예: {@code /api/v1/auth/%6Cogin}). 예전처럼 무제한 통과시키면 문자열 한 글자만 바꿔 제한을 벗어날 수 있으므로 fail-closed 로
     * 둔다.
     */
    private static final Bandwidth FALLBACK_LIMIT =
            Bandwidth.classic(10, Refill.intervally(10, Duration.ofMinutes(1)));

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
        //
        // 보안: takedown 판정은 URI 문자열이 아니라 **Spring 이 이미 매칭한 핸들러**로 한다.
        // URI 정규식(\\d+)으로 판정하면 우회가 열린다 — @PathVariable Long 은 NumberUtils 를 거쳐
        // Long.decode 로 파싱되므로 "/api/popups/0x7B/takedown" 이 정규식에는 안 걸리면서
        // 컨트롤러에서는 id=123 으로 정상 실행된다. "%74akedown" 같은 인코딩 우회도 같은 원리다.
        // 핸들러로 판정하면 어떤 표기로 들어오든 같은 메서드로 수렴한다.
        boolean takedown = isTakedown(handler);
        String uri = request.getRequestURI();

        Bandwidth limit = takedown ? takedownBandwidth() : resolveLimit(uri);
        if (limit == null) {
            // fail-closed: 이 인터셉터는 등록된 민감 경로에서만 호출된다. 경로 표기를 못 알아봤다는 건
            // 우회 시도일 가능성이 높으므로 무제한 통과시키지 않고 보수적 기본값을 적용한다.
            limit = FALLBACK_LIMIT;
        }

        String key = (takedown ? BUCKET_TAKEDOWN : uri) + "|" + clientIp(request);
        Bandwidth effectiveLimit = limit;
        Bucket bucket = buckets.get(key, k -> Bucket.builder().addLimit(effectiveLimit).build());

        if (bucket.tryConsume(1)) return true;

        rejectAsRateLimited(request, response);
        return false;
    }

    /** 요청이 권리자 takedown 핸들러로 매핑됐는지 — 문자열이 아니라 실제 매칭 결과로 판정. */
    private boolean isTakedown(Object handler) {
        return handler instanceof HandlerMethod hm
                && PopupStoreController.class.equals(hm.getBeanType())
                && TAKEDOWN_METHOD_NAME.equals(hm.getMethod().getName());
    }

    private Bandwidth takedownBandwidth() {
        return Bandwidth.classic(
                LIMIT_TAKEDOWN_PER_HOUR,
                Refill.intervally(LIMIT_TAKEDOWN_PER_HOUR, Duration.ofHours(1)));
    }

    private Bandwidth resolveLimit(String uri) {
        if ("/api/game/start".equals(uri)) {
            return Bandwidth.classic(
                    LIMIT_GAME_START_PER_MIN,
                    Refill.intervally(LIMIT_GAME_START_PER_MIN, Duration.ofMinutes(1)));
        }
        if (uri.startsWith("/api/game/")
                || uri.startsWith("/api/visits")
                || uri.startsWith("/api/planning/")
                || uri.startsWith("/api/chat/")
                || uri.startsWith("/api/mates/")
                || uri.startsWith("/api/music/")
                || "/api/popups/report".equals(uri)
                || uri.matches("/api/popups/[^/]+/wait")
                || "/api/client-errors".equals(uri)) {
            return Bandwidth.classic(
                    LIMIT_GENERAL_PER_MIN,
                    Refill.intervally(LIMIT_GENERAL_PER_MIN, Duration.ofMinutes(1)));
        }
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

    /**
     * 신뢰 가능한 클라이언트 IP.
     *
     * <p>보안: 이전 구현은 {@code X-Forwarded-For} 의 <b>첫</b> 항목을 썼는데, 이는 클라이언트가 보낸 값이다. nginx 의 {@code
     * $proxy_add_x_forwarded_for} 는 "클라이언트가 보낸 XFF + 실제 IP" 로 <b>덧붙이기</b> 때문에, 공격자가 매 요청마다 {@code
     * X-Forwarded-For: 1.2.3.4} 를 바꿔 보내면 버킷 키가 매번 달라져 레이트리밋이 통째로 무력화됐다.
     *
     * <p>순서를 바꾼다:
     *
     * <ol>
     *   <li>{@code X-Real-IP} — nginx 가 {@code proxy_set_header} 로 <b>덮어쓰므로</b> 클라이언트가 위조할 수 없다.
     *   <li>{@code X-Forwarded-For} 의 <b>마지막</b> 항목 — 우리 nginx 가 덧붙인 실제 접속 IP.
     *   <li>{@code remoteAddr} — 프록시를 거치지 않은 직결 요청(로컬 개발).
     * </ol>
     *
     * <p>주의: 앞단에 프록시를 하나 더 두게 되면 "마지막에서 N번째" 로 조정해야 한다.
     */
    private String clientIp(HttpServletRequest req) {
        if (!trustProxyHeaders) return req.getRemoteAddr();
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();

        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] hops = xff.split(",");
            String last = hops[hops.length - 1].trim();
            if (!last.isEmpty()) return last;
        }
        return req.getRemoteAddr();
    }
}
