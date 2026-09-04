package com.example.popspotbackend.config;

import com.example.popspotbackend.service.CustomOAuth2UserService;
import com.example.popspotbackend.service.admin.AdminAuditService;
import com.example.popspotbackend.service.auth.OAuthAttemptStore;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.HeaderWriterFilter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Spring Security 설정.
 *
 * <p>요약: CORS 는 와일드카드 단독을 금지하고 {@code APP_ALLOWED_ORIGINS} 화이트리스트만 허용한다. 세션은 STATELESS (JWT 만 신뢰),
 * 메서드 단 {@code @PreAuthorize} 활성화, BCrypt strength 12, {@code /actuator/**} 는 ADMIN 전용이고 {@code
 * /actuator/health} 만 외부 공개한다.
 *
 * <p>{@code /api/**} 의 인증 실패는 리다이렉트가 아니라 401 JSON 으로 끝낸다 — {@link #apiUnauthorizedEntryPoint()} 참고.
 */
@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private static final int BCRYPT_STRENGTH = 12;
    private static final String LOCAL_DEV_ORIGIN = "http://localhost:3000";
    private static final long CORS_MAX_AGE_SECONDS = 3600L;

    /** 리다이렉트 대신 401/403 JSON 을 돌려줄 경로. 브라우저 로그인 흐름(/oauth2, /login)은 여기에 걸리지 않는다. */
    private static final String API_PATH_PATTERN = "/api/**";

    private static final String CONTENT_TYPE_JSON = "application/json;charset=UTF-8";

    // 본문 규격은 GlobalExceptionHandler 의 {status, error, message, timestamp} 와 동일하게 맞춘다.
    // 프론트가 오류 응답을 한 가지 모양으로만 파싱하면 되도록.
    private static final String ERROR_BODY_TEMPLATE =
            "{\"status\":%d,\"error\":\"%s\",\"message\":\"%s\",\"timestamp\":\"%s\"}";

    private static final String MESSAGE_UNAUTHORIZED = "인증이 필요합니다.";
    private static final String MESSAGE_FORBIDDEN = "접근 권한이 없습니다.";

    private static final List<String> ALLOWED_METHODS =
            List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD");
    private static final List<String> ALLOWED_HEADERS =
            List.of(
                    "Authorization",
                    "Content-Type",
                    "Accept",
                    "Origin",
                    "X-Requested-With",
                    "Cache-Control",
                    "X-XSRF-TOKEN");

    /**
     * 브라우저가 <b>읽게 허용할</b> 응답 헤더.
     *
     * <p>여기 없는 헤더는 서버가 보내도 자바스크립트에서 {@code null} 로 보인다. 요청은 성공하고 헤더도 실제로 오는데 읽기만 막히는 것이라, 빠뜨리면 오류
     * 없이 조용히 동작만 사라진다. 같은 출처로 개발할 때는 멀쩡하고 배포한 뒤에야 드러난다.
     */
    private static final List<String> EXPOSED_HEADERS =
            List.of("Authorization", "Content-Disposition", "X-Popspot-Truncated");

    private static final String[] PUBLIC_PATHS = {
        "/",
        "/api/**",
        "/login/**",
        "/oauth2/**",
        "/signup/**",
        "/error",
        "/favicon.ico",
        "/ws-stomp/**",
        "/ws-planning/**",
        "/uploads/**"
    };

    /** 감사 기록 대상인 관리자 영역. */
    private static final String ADMIN_PATH_PREFIX = "/api/admin/";

    /** Spring 기본값. 클라이언트는 이 아래로 {provider} 를 붙여 로그인을 시작한다. */
    private static final String AUTHORIZATION_BASE_URI = "/oauth2/authorization";

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final AdminAuditService adminAuditService;
    private final OAuthAttemptStore oAuthAttemptStore;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    /** 쉼표 구분 화이트리스트. 운영에서는 .env 의 {@code APP_ALLOWED_ORIGINS} 로 주입. */
    @Value("${app.allowed-origins:http://localhost:3000}")
    private String allowedOriginsRaw;

    /** 활성 프로필. prod 에서는 localhost 를 CORS 허용 목록에 자동 추가하지 않는다. */
    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(BCRYPT_STRENGTH);
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http, ClientRegistrationRepository clientRegistrations) throws Exception {
        RequestMatcher apiMatcher =
                PathPatternRequestMatcher.withDefaults().matcher(API_PATH_PATTERN);
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // CVE-2026-22732 임시 대응 — Spring Security 7.0.0~7.0.3 은 보안 응답 헤더가
                // 아예 안 실릴 수 있다(현재 7.0.2). 캐시 관련 헤더가 빠지면 인증이 필요한 응답이
                // 중간 캐시에 남을 수 있어 등급이 CRITICAL 이다.
                //
                // 공식 권고의 임시 대응이 이 값이다. 헤더를 <b>응답을 쓰기 전에 먼저</b> 심으므로,
                // 애플리케이션이 나중에 넣는 캐시 헤더가 Security 의 것을 덮지 못한다 — 그게 이
                // 설정의 동작 변화이고, API 서버라 캐시 헤더를 직접 다루는 곳이 없어 문제되지 않는다.
                //
                // 설정 DSL 에는 이 옵션이 없어서(HeadersConfigurer 7.0.2 에 없음) 필터를 만드는
                // 시점에 직접 켠다. 7.0.4 이상으로 올리면 이 블록을 지운다.
                .headers(
                        headers ->
                                headers.withObjectPostProcessor(
                                        new ObjectPostProcessor<HeaderWriterFilter>() {
                                            @Override
                                            public <O extends HeaderWriterFilter> O postProcess(
                                                    O filter) {
                                                filter.setShouldWriteHeadersEagerly(true);
                                                return filter;
                                            }
                                        }))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(
                        jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(CorsUtils::isPreFlightRequest)
                                        .permitAll()
                                        .requestMatchers("/actuator/health", "/actuator/health/**")
                                        .permitAll()
                                        // D-4 — 역할을 나눈 두 구역. 아래 "/api/admin/**"
                                        // 보다 먼저 와야 한다(앞선 규칙이 이긴다).
                                        //
                                        // 나누지 않은 경로는 아래 규칙에 걸려 ADMIN 전용으로
                                        // 남는다. 새로 생기는 관리자 화면이 <b>기본적으로
                                        // 닫혀 있는</b> 쪽이라, 여기를 넓히는 것보다 안전하다.
                                        //
                                        // 정확 경로와 "/**" 를 함께 적는다 — 목록 조회는
                                        // 하위 경로가 아니라 이 경로 그대로 부른다.
                                        .requestMatchers(
                                                "/api/admin/audit",
                                                "/api/admin/audit/**",
                                                "/api/admin/security",
                                                "/api/admin/security/**")
                                        .hasAnyRole("ADMIN", "SECURITY")
                                        .requestMatchers(
                                                "/api/admin/visits",
                                                "/api/admin/visits/**",
                                                "/api/admin/metrics",
                                                "/api/admin/metrics/**")
                                        .hasAnyRole("ADMIN", "ANALYTICS")
                                        .requestMatchers("/api/admin/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers("/actuator/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers(PUBLIC_PATHS)
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                // 경로 한정으로만 등록한다. 전역 authenticationEntryPoint() 로 덮어쓰면 oauth2Login 이
                // 심어둔 리다이렉트 진입점까지 사라져 소셜 로그인이 죽는다. 여기 매처에 안 걸리는
                // 요청(/oauth2/**, /login/**, /actuator/**)은 기존 동작을 그대로 유지한다.
                .exceptionHandling(
                        ex ->
                                ex.defaultAuthenticationEntryPointFor(
                                                apiUnauthorizedEntryPoint(), apiMatcher)
                                        .defaultAccessDeniedHandlerFor(
                                                apiForbiddenHandler(), apiMatcher))
                .oauth2Login(
                        oauth2 ->
                                oauth2
                                        // 로그인 시작 요청의 PKCE 챌린지를 state 로 기록해 둔다.
                                        // 그래야 콜백에서 교환 코드에 묶을 수 있다.
                                        .authorizationEndpoint(
                                                a ->
                                                        a.authorizationRequestResolver(
                                                                new PkceAuthorizationRequestResolver(
                                                                        clientRegistrations,
                                                                        AUTHORIZATION_BASE_URI,
                                                                        oAuthAttemptStore)))
                                        .userInfoEndpoint(
                                                userInfo ->
                                                        userInfo.userService(
                                                                customOAuth2UserService))
                                        .successHandler(oAuth2SuccessHandler)
                                        .failureUrl(buildOAuthFailureUrl()));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origins = parseOrigins(allowedOriginsRaw, frontendUrl);
        log.info("CORS allowed origins: {}", origins);

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(ALLOWED_METHODS);
        config.setAllowedHeaders(ALLOWED_HEADERS);
        config.setExposedHeaders(EXPOSED_HEADERS);
        config.setMaxAge(CORS_MAX_AGE_SECONDS);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * {@code /api/**} 인증 실패 시 401 JSON. (인증 정보가 아예 없거나 만료된 경우)
     *
     * <p>왜: {@code oauth2Login()} 이 기본으로 심는 진입점은 미인증 요청을 브라우저 로그인 페이지로 <b>302 리다이렉트</b>한다. 그래서
     * {@code GET /api/admin/stats} 가 302 → 스프링 기본 "Please sign in" HTML 200 으로 끝났다. 브라우저 fetch
     * 입장에서는 다른 오리진으로 튕긴 요청이라 CORS 로 막히고, 프론트는 "인증 만료"인지 "서버 장애"인지 구분할 수 없는 정체불명 네트워크 오류만 받는다.
     * 사용자에게는 데이터가 통째로 사라진 것처럼 보였다. API 는 리다이렉트하지 말고 상태코드로 말해야 한다.
     */
    private AuthenticationEntryPoint apiUnauthorizedEntryPoint() {
        return (request, response, authException) ->
                writeErrorBody(
                        response, HttpStatus.UNAUTHORIZED, "Unauthorized", MESSAGE_UNAUTHORIZED);
    }

    /**
     * {@code /api/**} 인증은 됐으나 권한이 모자랄 때 403 JSON. 401 과 구분돼야 프론트가 재로그인 유도 여부를 판단할 수 있다.
     *
     * <p>관리자 영역의 권한 거부는 감사 표에도 남긴다. 이 경로는 <b>인터셉터가 볼 수 없다</b> — 권한 거부는 Spring Security 필터가
     * DispatcherServlet 앞에서 끊어 버려서, MVC 인터셉터까지 요청이 오지 않는다. 여기서 남기지 않으면 "권한 없는 사람이 관리자 주소를 두드렸다" 는
     * 신호가 통째로 사라진다.
     *
     * <p><b>응답을 먼저 확정하고 기록한다.</b> 순서가 반대면 DB 가 느릴 때 그 대기 시간이 그대로 403 응답 지연이 된다. 감사 기록 때문에 응답이 늦어지는
     * 것은 곁다리가 본체를 붙잡는 것이라 받아들일 수 없다.
     */
    private AccessDeniedHandler apiForbiddenHandler() {
        return (request, response, accessDeniedException) -> {
            writeErrorBody(response, HttpStatus.FORBIDDEN, "Forbidden", MESSAGE_FORBIDDEN);
            if (request.getRequestURI().startsWith(ADMIN_PATH_PREFIX)) {
                adminAuditService.recordAccessDenied(
                        currentActorId(), request.getMethod() + " " + request.getRequestURI());
            }
        };
    }

    /** 감사 기록용 행위자. 익명은 이 프로젝트에서도 {@code isAuthenticated()} 가 참이라 이름으로 걸러야 한다. */
    private static String currentActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        String name = auth.getName();
        return name == null || name.isBlank() || "anonymousUser".equals(name) ? null : name;
    }

    /**
     * 오류 본문 직접 기록.
     *
     * <p>본문에 들어가는 값은 전부 상수 + ISO-8601 타임스탬프뿐이라 JSON 이스케이프가 필요 없다. 요청에서 온 문자열은 한 글자도 넣지 않는다(본문 주입 방지
     * 겸 내부 정보 노출 방지).
     */
    private static void writeErrorBody(
            HttpServletResponse response, HttpStatus status, String error, String message)
            throws IOException {
        // SSE 등 이미 응답이 나가기 시작한 경우 덮어쓰면 "response already committed" 로 터진다.
        if (response.isCommitted()) return;
        response.setStatus(status.value());
        response.setContentType(CONTENT_TYPE_JSON);
        response.getWriter()
                .write(
                        String.format(
                                ERROR_BODY_TEMPLATE,
                                status.value(),
                                error,
                                message,
                                OffsetDateTime.now()));
    }

    private String buildOAuthFailureUrl() {
        String prefix = (frontendUrl == null || frontendUrl.isEmpty()) ? "" : frontendUrl;
        return prefix + "/login?error";
    }

    /** 쉼표 구분 문자열을 origin 리스트로 변환. fallback URL 과 로컬 개발 origin 을 항상 포함시켜 빠뜨림을 방지한다. */
    private List<String> parseOrigins(String raw, String fallback) {
        Set<String> set = new LinkedHashSet<>();
        if (raw != null && !raw.isBlank()) {
            Arrays.stream(raw.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(set::add);
        }
        if (fallback != null && !fallback.isBlank()) {
            set.add(fallback.trim());
        }
        // 보안(v2.22): 운영(prod)에서는 localhost 를 허용 origin 에 넣지 않는다. credentials=true 와
        // 결합 시 불필요한 노출이라 dev/test 편의용으로만 추가.
        if (!"prod".equalsIgnoreCase(activeProfile)) {
            set.add(LOCAL_DEV_ORIGIN);
        }
        return new ArrayList<>(set);
    }
}
