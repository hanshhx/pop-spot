package com.example.popspotbackend.config;

import com.example.popspotbackend.controller.MusicController;
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
 *
 * <p>v2.41 — 인증이 없으면서 <b>호출 자체가 비용이거나 데이터를 조작</b>하는 경로(방문 비콘·T맵 프록시·사용자 AI·재생실패 신고)도 대상에 넣었다. 이
 * 경로들은 실패해도 401 이 아니라 "그냥 되는" 엔드포인트라, 인증 대신 호출 빈도로만 방어할 수 있다.
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

    /** 익명 방문 비콘 — 무인증 POST 라 반복 호출로 visit_log 를 키우고 관리자 통계를 왜곡할 수 있다. */
    private static final String PATH_VISITS = "/api/visits";

    /**
     * 자연어(AI) 팝업 검색.
     *
     * <p>{@code /api/search/**} 로 넓히지 않는다. 같은 프리픽스의 {@code /api/search/sync} 는 LLM 을 쓰지 않는 일반 검색이라
     * 같은 한도를 씌우면 정상 사용자가 막힌다.
     */
    private static final String PATH_AI_SEARCH = "/api/search/ai";

    /** T맵 보행자 경로 프록시 프리픽스 — {@code TmapController} 전용이라 하위 전체를 같은 한도로 묶는다. */
    private static final String PREFIX_TMAP = "/api/tmap/";

    /** AI 코스추천 프리픽스 — {@code CourseController} 전용이며 엔드포인트는 {@code /recommend} 하나뿐이다. */
    private static final String PREFIX_AI_COURSE = "/api/courses/";

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

    /**
     * 음악 재생실패 신고 핸들러 메서드명 — {@link MusicController#markPlaybackFailed}.
     *
     * <p>takedown 과 똑같은 이유로 URI 문자열이 아니라 핸들러로 판정한다. {@code @PathVariable Long trackId} 는 {@code
     * Long.decode} 를 거치므로 {@code /api/music/0x7B/playback-failed} 가 URI 패턴을 피하면서 컨트롤러에서는
     * trackId=123 으로 정상 실행된다. {@code %70layback-failed} 같은 인코딩 우회도 같다.
     */
    private static final String PLAYBACK_FAILED_METHOD_NAME = "markPlaybackFailed";

    /**
     * 재생실패 신고 전용 버킷 이름.
     *
     * <p>takedown 과 같은 문제다. 버킷 키를 URI 로 잡으면 트랙마다 키가 갈려 "트랙 1개당 10회" 가 된다. 공격자는 서로 다른 트랙 수천 개를 각각
     * 임계값만큼만 신고하면 그만이라, 추천 후보에서 임의 트랙을 마음대로 없앨 수 있다. 기능 단위로 묶어 IP 당 총량을 센다.
     */
    private static final String BUCKET_PLAYBACK_FAILED = "playback-failed";

    private static final int LIMIT_LOGIN_PER_MIN = 5;
    private static final int LIMIT_EMAIL_PER_HOUR = 5;
    private static final int LIMIT_VERIFY_PER_MIN = 10;
    private static final int LIMIT_ENUM_PER_MIN = 20;
    private static final int LIMIT_TAKEDOWN_PER_HOUR = 3;
    private static final int LIMIT_GAME_START_PER_MIN = 3;
    private static final int LIMIT_GENERAL_PER_MIN = 60;

    /**
     * 방문 비콘 30/분.
     *
     * <p>프론트({@code VisitTracker})는 세션·경로당 1회만 보내므로 정상 사용자에겐 과하게 넉넉한 값이다. 통신사 CGNAT 처럼 여러 명이 한 IP 를
     * 공유해 30회를 넘겨도 손해는 통계 한두 건 누락뿐이다 — 비콘은 응답을 보지 않는 fire-and-forget 이라 429 를 받아도 화면에 아무 영향이 없다.
     * 그래서 일반 60/분보다 낮춰도 안전하다.
     */
    private static final int LIMIT_VISITS_PER_MIN = 30;

    /**
     * T맵 경로 프록시 20/분.
     *
     * <p>서버의 <b>유료</b> T맵 AppKey 를 무인증으로 대신 써주는 프록시다. 길찾기는 사용자가 버튼을 눌러야 나가는 명시적 액션이라 20/분이면 충분하고,
     * 대량 호출로 키 쿼터를 태우는 것을 막는다.
     */
    private static final int LIMIT_TMAP_ROUTE_PER_MIN = 20;

    /**
     * 사용자 AI 호출(검색·코스추천) 각 5/분.
     *
     * <p>다른 경로보다 유독 낮게 잡는 이유: 이 둘은 호출 한 번이 곧 LLM 토큰이고, 사용자 AI 와 크롤러가 같은 계정 쿼터를 쓴다. 즉 여기서 쿼터가 소진되면
     * AI 검색이 죽는 데 그치지 않고 <b>팝업 수집까지 같이 멈춘다</b>. 둘 다 버튼을 눌러야 나가고 응답에 수 초가 걸리므로 5/분이 정상 사용을 방해하지 않는다.
     */
    private static final int LIMIT_AI_PER_MIN = 5;

    /**
     * 음악 재생실패 신고 10/분.
     *
     * <p>이 신고는 임계값 이상 누적되면 트랙을 추천 후보에서 <b>자동 제외</b>시킨다. 즉 조회가 아니라 데이터 변경이다. 실제 재생 실패는 곡을 넘길 때 드물게
     * 한두 번 발생하므로 10/분이면 정상 재생에 걸리지 않는다.
     */
    private static final int LIMIT_PLAYBACK_FAILED_PER_MIN = 10;

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
        // 보안: takedown·재생실패 신고 판정은 URI 문자열이 아니라 **Spring 이 이미 매칭한 핸들러**로 한다.
        // URI 정규식(\\d+)으로 판정하면 우회가 열린다 — @PathVariable Long 은 NumberUtils 를 거쳐
        // Long.decode 로 파싱되므로 "/api/popups/0x7B/takedown" 이 정규식에는 안 걸리면서
        // 컨트롤러에서는 id=123 으로 정상 실행된다. "%74akedown" 같은 인코딩 우회도 같은 원리다.
        // 핸들러로 판정하면 어떤 표기로 들어오든 같은 메서드로 수렴한다.
        String uri = request.getRequestURI();

        // 기능 단위로 세야 하는 경로(takedown·재생실패 신고)는 버킷 이름을 고정하고, 나머지는 URI 를 키로 쓴다.
        Bandwidth limit;
        String bucketName;
        if (isTakedown(handler)) {
            limit = takedownBandwidth();
            bucketName = BUCKET_TAKEDOWN;
        } else if (isPlaybackFailed(handler)) {
            limit = playbackFailedBandwidth();
            bucketName = BUCKET_PLAYBACK_FAILED;
        } else {
            limit = resolveLimit(uri);
            bucketName = uri;
        }

        if (limit == null) {
            // fail-closed: 이 인터셉터는 등록된 민감 경로에서만 호출된다. 경로 표기를 못 알아봤다는 건
            // 우회 시도일 가능성이 높으므로 무제한 통과시키지 않고 보수적 기본값을 적용한다.
            limit = FALLBACK_LIMIT;
        }

        String key = bucketName + "|" + clientIp(request);
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

    /** 요청이 음악 재생실패 신고 핸들러로 매핑됐는지 — takedown 과 같이 실제 매칭 결과로 판정. */
    private boolean isPlaybackFailed(Object handler) {
        return handler instanceof HandlerMethod hm
                && MusicController.class.equals(hm.getBeanType())
                && PLAYBACK_FAILED_METHOD_NAME.equals(hm.getMethod().getName());
    }

    private Bandwidth playbackFailedBandwidth() {
        return Bandwidth.classic(
                LIMIT_PLAYBACK_FAILED_PER_MIN,
                Refill.intervally(LIMIT_PLAYBACK_FAILED_PER_MIN, Duration.ofMinutes(1)));
    }

    private Bandwidth resolveLimit(String uri) {
        if ("/api/game/start".equals(uri)) {
            return Bandwidth.classic(
                    LIMIT_GAME_START_PER_MIN,
                    Refill.intervally(LIMIT_GAME_START_PER_MIN, Duration.ofMinutes(1)));
        }
        // 아래 세 갈래는 일반 60/분보다 먼저 본다. 호출 한 번이 곧 비용(유료 API·LLM 토큰)이거나 저장 데이터를
        // 늘리는 경로라 같은 한도로 묶으면 안 된다. 근거는 각 LIMIT_* 상수 주석.
        if (uri.startsWith(PREFIX_TMAP)) {
            return Bandwidth.classic(
                    LIMIT_TMAP_ROUTE_PER_MIN,
                    Refill.intervally(LIMIT_TMAP_ROUTE_PER_MIN, Duration.ofMinutes(1)));
        }
        if (uri.startsWith(PREFIX_AI_COURSE) || PATH_AI_SEARCH.equals(uri)) {
            return Bandwidth.classic(
                    LIMIT_AI_PER_MIN, Refill.intervally(LIMIT_AI_PER_MIN, Duration.ofMinutes(1)));
        }
        if (PATH_VISITS.equals(uri)) {
            return Bandwidth.classic(
                    LIMIT_VISITS_PER_MIN,
                    Refill.intervally(LIMIT_VISITS_PER_MIN, Duration.ofMinutes(1)));
        }
        if (uri.startsWith("/api/game/")
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
     *   <li>{@code X-Real-IP} — 앞단 프록시가 {@code proxy_set_header} 로 <b>덮어쓸 때만</b> 신뢰할 수 있다.
     *   <li>{@code X-Forwarded-For} 의 <b>마지막</b> 항목 — 앞단 프록시가 덧붙인 실제 접속 IP.
     *   <li>{@code remoteAddr} — 프록시를 거치지 않은 직결 요청(로컬 개발).
     * </ol>
     *
     * <p><b>알려진 한계(v2.41 감사에서 실증).</b> 위 1번은 {@code deploy/nginx-popspot.conf} 처럼 앞단이 헤더를 덮어쓰는 구성을
     * 전제한다. 지금 운영은 Tailscale Funnel 이 백엔드 앞단이고 이 구성에서는 {@code X-Real-IP} 가 덮어써지지 않아 클라이언트가 보낸 값이
     * 그대로 여기까지 온다. 429 를 받은 직후 이 헤더만 바꿔 보내면 새 버킷이 생겨 통과되는 것이 확인됐다. 즉 {@code
     * app.trust-proxy-headers=true} 인 지금, 아래의 모든 한도는 <b>성실한 사용자에겐 적용되지만 작정한 공격자는 우회할 수 있다</b>.
     *
     * <p>이걸 코드로 고치지 않은 이유: "몇 번째 홉을 믿을지" 는 코드가 아니라 배포 토폴로지가 정하는 값이다. 프론트가 Vercel rewrite 로 {@code
     * /api/*} 를 프록시하므로 앞단 홉이 하나 더 있을 수 있고, 여기서 잘못 짚어 XFF 마지막 항목을 쓰면 모든 사용자가 <b>같은 프록시 IP 한 개</b>로
     * 뭉쳐 전원 429 가 된다. 지금 동작을 깨는 쪽 손해가 훨씬 크다.
     *
     * <p>권장 조치(운영): 백엔드 앞에 리버스 프록시를 두고 {@code proxy_set_header X-Real-IP $remote_addr;} 로 이 헤더를
     * <b>무조건 덮어쓰게</b> 한다. 그러면 코드 변경 없이 1번이 다시 신뢰 가능한 값이 된다. 실제 홉 수를 확인한 뒤에야 이 메서드를 손대는 게 맞다.
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
