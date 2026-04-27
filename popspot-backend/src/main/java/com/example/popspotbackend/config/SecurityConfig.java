package com.example.popspotbackend.config;

import com.example.popspotbackend.service.CustomOAuth2UserService;
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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 보안 설정.
 *
 * 핵심 변경:
 * - CORS: 와일드카드 X. 환경변수 APP_ALLOWED_ORIGINS 화이트리스트만 허용.
 * - 세션: STATELESS (JWT 토큰만 신뢰).
 * - @EnableMethodSecurity: 컨트롤러 @PreAuthorize 활성화.
 * - BCrypt strength: 12.
 * - /actuator: ADMIN 전용. health 만 외부 공개.
 */
@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    /** 쉼표로 구분된 화이트리스트. 운영에서는 .env 의 APP_ALLOWED_ORIGINS 로 주입. */
    @Value("${app.allowed-origins:http://localhost:3000}")
    private String allowedOriginsRaw;

    @Bean
    public PasswordEncoder passwordEncoder() {
        // BCrypt strength=12 (기본 10보다 약 4배 느려 brute-force 방어)
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(CorsUtils::isPreFlightRequest).permitAll()

                        // health 만 외부 공개 (probe/loadbalancer 용)
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()

                        // 1️⃣ 관리자 / 모니터링
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/actuator/**").hasRole("ADMIN")

                        // 2️⃣ 일반 허용 (구체적인 보안은 메서드 단 @PreAuthorize 로)
                        .requestMatchers(
                                "/", "/api/**", "/login/**", "/oauth2/**", "/signup/**",
                                "/error", "/favicon.ico", "/ws-stomp/**", "/ws-planning/**", "/uploads/**"
                        ).permitAll()

                        // 3️⃣ 그 외는 인증 필요
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler(oAuth2SuccessHandler)
                        .failureUrl((frontendUrl == null || frontendUrl.isEmpty() ? "" : frontendUrl) + "/login?error")
                );
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origins = parseOrigins(allowedOriginsRaw, frontendUrl);
        log.info("🛡️ CORS allowed origins: {}", origins);

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        // setAllowedOrigins 는 정확 매칭. Vercel preview URL 패턴이 필요하면 setAllowedOriginPatterns 로 교체.
        // 단, "*" 와 allowCredentials=true 동시 사용 금지! (브라우저가 거부)
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"));
        config.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "Accept", "Origin",
                "X-Requested-With", "Cache-Control", "X-XSRF-TOKEN"
        ));
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

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
        // 로컬 개발 보장
        set.add("http://localhost:3000");
        return new ArrayList<>(set);
    }
}
