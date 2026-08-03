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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    /**
     * 로그인 2단계(TOTP) 검증.
     *
     * <p>6자리는 100만 가지뿐이라 <b>대입이 현실적으로 가능하다.</b> 챌린지 표가 한 번 쓰면 사라지긴 하지만, 비밀번호를 아는 상태에서 표를 계속 새로 받아
     * 시도할 수 있으므로 횟수도 함께 조인다.
     */
    private static final String PATH_LOGIN_TOTP = "/api/v1/auth/login/totp";

    private static final int LIMIT_TOTP_PER_MIN = 5;
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
     * 개인정보 해제 — 관리자 <b>계정당</b> 시간당 한도.
     *
     * <p>버킷 이름을 고정하는 이유: 경로에 회원 id 가 들어가므로 URI 를 키로 쓰면 <b>회원 한 명당</b> 한도가 되어, 명부를 통째로 훑는 데 아무 제약이
     * 없다. takedown 이 이미 같은 이유로 고정 버킷을 쓴다.
     */
    private static final String BUCKET_PII_REVEAL = "pii-reveal";

    private static final String PII_REVEAL_PATH_PREFIX = "/api/admin/reveal/";

    private static final int LIMIT_PII_REVEAL_PER_HOUR = 60;

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

    /** Spring 익명 인증의 사용자 이름. {@code isAuthenticated()} 가 참이라 이름으로 걸러야 한다. */
    private static final String ANONYMOUS_USER = "anonymousUser";

    private static final String ADMIN_PATH_PREFIX = "/api/admin/";

    /**
     * 관리자 API 한도(관리자 한 명당 · 경로당 · 분당).
     *
     * <p>화면이 서버 지표를 3초마다 가져가 그것만 분당 20회다. 목록을 넘기며 훑는 것도 겹치므로 120 으로 잡았다 — 정상 사용이 막히면 관리자가 이 기능 자체를
     * 꺼 버리게 된다.
     */
    private static final int LIMIT_ADMIN_PER_MIN = 120;

    /** 되돌릴 수 없거나 외부 비용이 드는 관리자 작업. */
    private static final int LIMIT_ADMIN_HEAVY_PER_MIN = 3;

    /**
     * 무겁게 취급할 관리자 경로.
     *
     * <p>기준은 셋 중 하나다 — 외부 API 를 수십~수백 번 부르거나(크롤·백필), 되돌릴 수 없거나(중복 정리·채팅 일괄삭제), 보안 조치라 반복될 이유가 없다(세션
     * 무효화).
     */
    private static final String[] ADMIN_HEAVY_PATHS = {
        // 외부 API 를 수십~수백 번 직렬 호출한다.
        //
        // 크롤은 클래스 단위 매핑이 /api/admin/popups/crawl 이라 하위 전체를 묶는다.
        "/api/admin/popups/crawl",
        "/api/admin/popups/backfill-photos",
        "/api/admin/popups/backfill-translations",
        // 커버 이미지 갱신은 음악 컨트롤러 아래다(/api/admin/music).
        "/api/admin/music/refresh-covers",
        // 되돌릴 수 없다.
        "/api/admin/popups/dedupe",
        "/api/admin/chat/delete-batch",
        // 보안 조치라 반복될 이유가 없다.
        "/api/admin/session/revoke-all",
    };

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

    /** 프론트를 거쳤음을 증명하는 서명 검증기. 비밀키 미설정 시 비활성이며 기존 판별로 되돌아간다. */
    private final EdgeSignatureVerifier edgeSignature;

    public RateLimitInterceptor(EdgeSignatureVerifier edgeSignature) {
        this.edgeSignature = edgeSignature;
    }

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
        } else if (uri.startsWith(PII_REVEAL_PATH_PREFIX)) {
            limit =
                    Bandwidth.classic(
                            LIMIT_PII_REVEAL_PER_HOUR,
                            Refill.intervally(LIMIT_PII_REVEAL_PER_HOUR, Duration.ofHours(1)));
            bucketName = BUCKET_PII_REVEAL;
        } else {
            limit = resolveLimit(uri);
            bucketName = uri;
        }

        if (limit == null) {
            // fail-closed: 이 인터셉터는 등록된 민감 경로에서만 호출된다. 경로 표기를 못 알아봤다는 건
            // 우회 시도일 가능성이 높으므로 무제한 통과시키지 않고 보수적 기본값을 적용한다.
            limit = FALLBACK_LIMIT;
        }

        // 개인정보 해제만 <b>계정 단독</b>으로 센다. 다른 관리자 경로는 계정+IP 인데, 그러면 IP 를
        // 바꿀 때마다 새 버킷이 생겨 한도가 사실상 없어진다. 평소에는 IP 를 섞는 편이 나은데
        // (같은 IP 의 여러 계정이 각자 한도를 갖는 것을 막는다), 이 경로만은 <b>공격자가 늘릴 수
        // 있는 축</b>인 IP 를 키에서 빼야 "계정당 시간당 60건" 이 실제로 성립한다.
        String identity =
                BUCKET_PII_REVEAL.equals(bucketName)
                        ? requireAccount()
                        : rateLimitIdentity(request, uri);
        String key = bucketName + "|" + identity;
        Bandwidth effectiveLimit = limit;
        Bucket bucket = buckets.get(key, k -> Bucket.builder().addLimit(effectiveLimit).build());

        if (bucket.tryConsume(1)) return true;

        rejectAsRateLimited(request, response);
        return false;
    }

    /**
     * 버킷을 나누는 기준 — 보통은 IP, <b>관리자 경로는 계정+IP</b>.
     *
     * <p>관리자 경로에서 IP 만 쓰면 두 가지가 곤란하다.
     *
     * <ul>
     *   <li>업로드·사진 백필·로그 스트림은 프론트가 백엔드를 <b>직접</b> 부른다(api.ts 의 FORCE_ABSOLUTE_PREFIXES). 엣지 서명이 안
     *       붙어 IP 가 {@code remoteAddr} 로 강등되므로, IP 만으로는 사실상 모든 관리자 요청이 한 바구니가 된다.
     *   <li>반대로 토큰이 샌 경우, 공격자가 IP 를 바꿔 가며 부르면 IP 기준 한도는 의미가 없다. 계정을 섞으면 <b>그 토큰 자체</b>에 한도가 걸린다.
     * </ul>
     *
     * <p>관리자 외 경로는 건드리지 않는다. 거기까지 계정을 섞으면 같은 IP 의 여러 계정이 각자 한도를 갖게 되어 <b>지금보다 느슨해진다</b>.
     */
    private String rateLimitIdentity(HttpServletRequest request, String uri) {
        String ip = clientIp(request);
        if (!uri.startsWith(ADMIN_PATH_PREFIX)) return ip;

        String account = currentAccountId();
        return account == null ? ip : account + "@" + ip;
    }

    /**
     * 해제 경로의 버킷 키 — 계정만. 계정을 못 구하면 IP 로 물러서지 않고 고정 문자열을 쓴다.
     *
     * <p>물러서면 비인증 요청 전체가 각자 IP 버킷을 갖게 되어 한도가 무의미해진다. 이 경로는 {@code @PreAuthorize} 로 관리자만 오므로 실제로는 항상
     * 계정이 있고, 없다면 그 자체가 비정상이라 전부 한 버킷으로 묶는 편이 안전하다.
     */
    private String requireAccount() {
        String account = currentAccountId();
        return account == null ? "(no-account)" : account;
    }

    /** 로그인한 사용자 id. 비로그인·익명이면 null — Spring 의 익명 인증은 이름이 anonymousUser 다. */
    private String currentAccountId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        String name = auth.getName();
        return name == null || name.isBlank() || ANONYMOUS_USER.equals(name) ? null : name;
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
        // v2.53 — 관리자 경로. 버킷 키에 계정이 섞이므로 아래 숫자는 "관리자 한 명당" 이다.
        if (uri.startsWith(ADMIN_PATH_PREFIX)) {
            // 되돌릴 수 없거나 외부 비용이 드는 작업. 사람이 분당 세 번 넘게 누를 일이 없다.
            for (String heavy : ADMIN_HEAVY_PATHS) {
                if (uri.startsWith(heavy)) {
                    return Bandwidth.classic(
                            LIMIT_ADMIN_HEAVY_PER_MIN,
                            Refill.intervally(LIMIT_ADMIN_HEAVY_PER_MIN, Duration.ofMinutes(1)));
                }
            }
            // 나머지 관리자 API. 화면이 지표를 3초마다 폴링하므로(분당 20회) 넉넉히 잡는다 —
            // 여기서 정상 사용이 막히면 관리자가 레이트리밋을 꺼 버리게 된다.
            return Bandwidth.classic(
                    LIMIT_ADMIN_PER_MIN,
                    Refill.intervally(LIMIT_ADMIN_PER_MIN, Duration.ofMinutes(1)));
        }

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
            case PATH_LOGIN_TOTP -> Bandwidth.classic(
                    LIMIT_TOTP_PER_MIN,
                    Refill.intervally(LIMIT_TOTP_PER_MIN, Duration.ofMinutes(1)));
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
     * <p><b>위 순서만으로는 부족하다(v2.41 감사에서 실증).</b> 1번은 앞단이 헤더를 덮어쓰는 구성을 전제하는데, 운영 앞단인 Tailscale Funnel 은
     * 덮어쓰지 않아 클라이언트가 보낸 {@code X-Real-IP} 가 그대로 여기까지 온다. 429 를 받은 직후 이 헤더만 바꿔 보내면 새 버킷이 생겨 통과되는 것이
     * 확인됐다. 그렇다고 {@code app.trust-proxy-headers=false} 로 두면 Funnel 내부 주소 하나만 보여 <b>전 사용자가 버킷 하나를
     * 공유</b>한다 — 인증메일 시간당 5회가 전체 합산이 되어 가입이 막힌다. <b>믿어도 뚫리고 안 믿어도 망가진다.</b>
     *
     * <p><b>그래서 v2.52 부터 {@link EdgeSignatureVerifier} 가 우선한다.</b> 신뢰 여부를 헤더 이름이 아니라 서명으로 판단한다 —
     * 프론트(Vercel)가 위조 불가능한 접속 IP에 HMAC 을 붙여 보내고, 서명이 맞을 때만 그 IP를 쓴다. 증명이 없으면 헤더를 일절 믿지 않고 {@code
     * remoteAddr} 로 강등하므로, Funnel 주소를 직접 때리는 요청은 전부 버킷 하나를 나눠 쓰게 된다.
     *
     * <p>아래 1~3번은 <b>비밀키를 설정하지 않았을 때의 기존 동작</b>으로 남는다. 켜고 끄는 것을 배포와 분리하기 위해서다.
     */
    private String clientIp(HttpServletRequest req) {
        // 서명 검증이 켜져 있으면 증명된 IP만 쓴다. 증명이 없으면 헤더는 보지 않는다 — 위조 경로를 닫는 지점.
        if (edgeSignature.isEnabled()) {
            String verified = edgeSignature.verifiedIp(req);
            return verified != null ? verified : req.getRemoteAddr();
        }

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
