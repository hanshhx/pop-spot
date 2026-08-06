package com.example.popspotbackend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring MVC 설정 — 업로드 폴더 정적 매핑과 Rate Limit Interceptor 등록.
 *
 * <p>{@code addCorsMappings} 는 의도적으로 비워둔다. CORS 는 {@code SecurityConfig#corsConfigurationSource} 가
 * 단일 진실 공급원이며 두 곳에서 설정하면 충돌해 invalid CORS 응답이 발생한다.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private static final String UPLOAD_URL_PATTERN = "/uploads/**";
    private static final String AUTH_PATH_PATTERN = "/api/v1/auth/**";
    private static final String[] RATE_LIMITED_API_PATTERNS = {
        // v2.53 — 관리자 API. 여기 없어서 무제한이었다.
        //
        // 권한 검사(hasRole('ADMIN'))는 통과 여부만 정하지 <b>횟수를 세지 않는다</b>. 토큰이 한 번
        // 새면 크롤 실행·사진 백필·보상 지급을 무한히 부를 수 있었다. 게다가 업로드·백필·로그
        // 스트림은 프론트가 백엔드를 직접 부르므로 앞단에 방화벽을 둬도 지나지 않는다 —
        // 횟수 제한은 이 애플리케이션이 스스로 해야 한다.
        "/api/admin/**",
        "/api/game/**",
        "/api/visits",
        // 행동 비콘. "/api/visits" 는 그 경로 하나만 매칭하므로 따로 적어야 한다 —
        // 빠뜨리면 인증 없이 부를 수 있는 경로가 무제한이 된다.
        "/api/visits/events",
        "/api/planning/**",
        "/api/chat/**",
        "/api/mates",
        "/api/mates/**",
        "/api/music/**",
        "/api/popups/report",
        "/api/popups/*/wait",
        "/api/client-errors",
        // v2.41 — 인증이 없으면서 호출 자체가 비용이거나 데이터를 바꾸는 경로. 실제 한도는 RateLimitInterceptor 참고.
        // /api/tmap/** : 서버의 유료 T맵 AppKey 를 대신 써주는 프록시(TmapController 전용 프리픽스).
        // /api/courses/** : AI 코스추천. CourseController 전용이고 엔드포인트는 /recommend 하나뿐.
        // /api/search/ai : AI 검색. 같은 프리픽스의 /api/search/sync 는 LLM 을 안 쓰므로 /** 로 넓히지 않는다.
        "/api/tmap/**",
        "/api/courses/**",
        "/api/search/ai",
        // v2.41 — 의견 보내기. 비로그인 게스트가 그대로 POST 할 수 있는데(FeedbackController 가 인증
        // 없으면 userId null 로 두고 허용), 지금까지는 진입점이 푸터 링크와 MY 탭뿐이라 노출이 적었다.
        // 이번에 SEO 랜딩 167개와 메인에 버튼을 깔면서 스팸 표면이 커져 같이 한도를 건다.
        "/api/feedback"
    };

    /**
     * 권리자 takedown 신고 경로 — 레이트리밋 대상.
     *
     * <p>이 엔드포인트는 인증 없이 관리자 검토 큐에 신고를 넣는다. 자동 숨김은 하지 않지만 대량 신고로 검토 큐를 마비시키는 행위를 막기 위해 호출 빈도를 제한한다.
     * 실제 제한값은 {@link RateLimitInterceptor} 가 정한다.
     */
    private static final String TAKEDOWN_PATH_PATTERN = "/api/popups/*/takedown";

    /** 감사 로그 대상 — 관리자 API 전체. */
    private static final String ADMIN_PATH_PATTERN = "/api/admin/**";

    /**
     * 차단 관리 경로 — 차단 검사에서 <b>제외</b>한다.
     *
     * <p>{@code AdminIpBlockController} 의 매핑과 같아야 한다. 여기만 고치고 저기를 안 고치면 탈출구가 조용히 사라지고, 그 사실은 <b>실제로
     * 잠긴 뒤에야</b> 알게 된다.
     */
    static final String IP_BLOCK_ADMIN_PATTERN = "/api/admin/security/ip-blocks/**";

    /**
     * 회원 콘텐츠 경로 — 약관 §14 비색인 대상(동행·의견·채팅).
     *
     * <p>{@code /api/mates} 처럼 하위 세그먼트가 없는 경로와 {@code /api/mates/{id}/chat} 같은 하위 경로를 모두 덮기 위해 정확
     * 경로와 {@code /**} 를 함께 등록한다.
     */
    private static final String[] MEMBER_CONTENT_PATTERNS = {
        "/api/mates",
        "/api/mates/**",
        "/api/feedback",
        "/api/feedback/**",
        "/api/chat",
        "/api/chat/**"
    };

    @Value("${app.upload.path}")
    private String uploadPath;

    private final IpBlockInterceptor ipBlockInterceptor;
    private final RateLimitInterceptor rateLimitInterceptor;
    private final AdminAuditInterceptor adminAuditInterceptor;
    private final AdminReauthInterceptor adminReauthInterceptor;
    private final PolicyConsentInterceptor policyConsentInterceptor;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path base = Paths.get(uploadPath).toAbsolutePath().normalize();

        // 부팅 시점에 디렉터리를 만들어 둔다. 두 가지 이유가 있다.
        // (1) Paths.toUri() 는 디렉터리가 **실재할 때만** 후행 슬래시를 붙인다. 없으면 매핑 문자열이
        //     디렉터리가 아닌 파일로 해석돼 /uploads/** 서빙이 통째로 404 가 된다.
        // (2) APP_UPLOAD_PATH 가 /var/popspot/uploads 처럼 홈 밖을 가리키는데 실행 계정에 권한이 없으면
        //     업로드가 500 으로 실패한다. 여기서 미리 실패를 로그로 드러내 배포 직후 바로 알 수 있게 한다.
        try {
            Files.createDirectories(base.resolve("avatar"));
        } catch (IOException e) {
            log.error("[WebConfig] 업로드 디렉터리 생성 실패 — 업로드가 실패합니다. 경로={} 원인={}", base, e.toString());
        }

        String resourcePath = base.toUri().toString();
        if (!resourcePath.endsWith("/")) resourcePath += "/";

        log.info("[WebConfig] 업로드 폴더 매핑: {} → {}", UPLOAD_URL_PATTERN, resourcePath);
        registry.addResourceHandler(UPLOAD_URL_PATTERN).addResourceLocations(resourcePath);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        /*
         * D-2 차단은 <b>가장 앞</b>이다. 차단된 요청은 아무 비용도 쓰면 안 되고, 감사 표를
         * 공격자의 시도로 채우지도 않아야 한다 — 차단 자체가 이미 기록이다.
         *
         * 차단 관리 경로만 빼 둔다. <b>잠금 탈출구</b>다. 관리자의 IP 는 바뀌고, 예전에 걸어 둔
         * 주소를 나중에 다시 배정받는 일이 실제로 있다. 그때 이 경로까지 막히면 스스로 풀 방법이
         * 없어져 서버에 직접 들어가야 한다. 인증(ADMIN)은 그대로라 열어 둬도 위험하지 않다.
         */
        registry.addInterceptor(ipBlockInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(IP_BLOCK_ADMIN_PATTERN);

        // 감사 로그를 <b>요청 제한보다 먼저</b> 등록한다. 순서가 반대면 제한에 걸려 429 로 끝난
        // 관리자 요청이 한 줄도 남지 않는다 — 앞선 인터셉터가 요청을 막으면 뒤에 등록된
        // 인터셉터의 afterCompletion 은 호출되지 않기 때문이다. 관리자 계정이 갑자기 제한에
        // 걸리기 시작하는 것 자체가 봐야 할 신호라, 그게 사라지면 안 된다.
        registry.addInterceptor(adminAuditInterceptor).addPathPatterns(ADMIN_PATH_PATTERN);

        // 감사 <b>뒤</b>, 요청 제한 <b>앞</b>이다. 재확인이 없어 428 로 막힌 요청도 감사 표에는
        // 남아야 하고(누가 무엇을 하려 했는지가 신호다), 한도는 소모하지 않는 편이 맞다.
        registry.addInterceptor(adminReauthInterceptor).addPathPatterns(ADMIN_PATH_PATTERN);

        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns(AUTH_PATH_PATTERN, TAKEDOWN_PATH_PATTERN)
                .addPathPatterns(RATE_LIMITED_API_PATTERNS);
        registry.addInterceptor(policyConsentInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/v1/auth/**",
                        "/api/v1/terms/**",
                        "/api/visits",
                        "/api/visits/events",
                        "/api/client-errors",
                        // 계정 보호 장치는 정책 동의보다 뒤에 서면 안 된다. 토큰이 샜다고 의심되는
                        // 순간에 "먼저 약관에 동의하세요" 가 뜨면 비상 스위치가 비상용이 아니다.
                        // 이 경로들은 이미 관리자 권한 + 재인증 + 감사 로그로 보호된다.
                        "/api/admin/session/**",
                        "/api/admin/reauth",
                        "/api/admin/reauth/**",
                        "/api/admin/totp/**",
                        TAKEDOWN_PATH_PATTERN);
        // 보안(v2.22): 업로드 파일 응답에 nosniff — 이미지로 위장한 HTML/SVG 가 브라우저 MIME
        // 스니핑으로 실행되는 것을 차단. inline 이미지 표시는 유지(Content-Disposition 미설정).
        registry.addInterceptor(new NoSniffInterceptor()).addPathPatterns(UPLOAD_URL_PATTERN);
        // 약관 §14: 회원 콘텐츠(동행·의견·채팅)는 검색엔진에 색인하지 않는다. 응답 헤더로 구조적으로 막는다.
        registry.addInterceptor(new MemberContentNoIndexInterceptor())
                .addPathPatterns(MEMBER_CONTENT_PATTERNS);
    }

    /** {@code /uploads/**} 응답에 실행 방지와 검색 색인 차단 헤더를 함께 부착. */
    static class NoSniffInterceptor implements HandlerInterceptor {
        @Override
        public boolean preHandle(
                HttpServletRequest request, HttpServletResponse response, Object handler) {
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
            return true;
        }
    }

    /**
     * 회원 콘텐츠 응답에 {@code X-Robots-Tag: noindex} 부착 — 약관 §14 비색인 약속의 구조적 보장.
     *
     * <p>이 콘텐츠는 지금 홈 안 클라이언트 렌더라 검색엔진이 볼 경로가 없지만, 그 안전은 설계가 아니라 우연이다. API 는 인증 없이 열려 있고, 새 조회 경로나
     * SSR 이 생기면 언제든 노출될 수 있다. 응답 헤더로 색인을 막아 우연에 기대지 않는다.
     */
    static class MemberContentNoIndexInterceptor implements HandlerInterceptor {
        @Override
        public boolean preHandle(
                HttpServletRequest request, HttpServletResponse response, Object handler) {
            response.setHeader("X-Robots-Tag", "noindex, nofollow");
            return true;
        }
    }
}
