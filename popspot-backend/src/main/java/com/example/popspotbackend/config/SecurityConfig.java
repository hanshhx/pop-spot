package com.example.popspotbackend.config;

import com.example.popspotbackend.service.CustomOAuth2UserService;
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
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
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
    private static final List<String> EXPOSED_HEADERS =
            List.of("Authorization", "Content-Disposition");

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

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

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
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(
                        jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(CorsUtils::isPreFlightRequest)
                                        .permitAll()
                                        .requestMatchers("/actuator/health", "/actuator/health/**")
                                        .permitAll()
                                        .requestMatchers("/api/admin/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers("/actuator/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers(PUBLIC_PATHS)
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .oauth2Login(
                        oauth2 ->
                                oauth2.userInfoEndpoint(
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
