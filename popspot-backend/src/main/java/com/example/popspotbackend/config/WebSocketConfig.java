package com.example.popspotbackend.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * STOMP WebSocket 엔드포인트 설정.
 *
 * <p>SecurityConfig 와 동일한 {@code APP_ALLOWED_ORIGINS} 화이트리스트만 허용해 CSRF/도청을 방어한다. 핸드셰이크 단계에서 JWT 가
 * 있으면 검증해 {@code userId}/{@code role} 을 attributes 에 담아 두고, 없거나 검증이 실패해도 익명 채팅 호환을 위해 통과시킨다 — 인증
 * 체크는 메시지 발행 단에서 처리.
 */
@Slf4j
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final int JWT_SECRET_MIN_BYTES = 32;
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String LOCAL_DEV_ORIGIN = "http://localhost:3000";

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.allowed-origins:http://localhost:3000}")
    private String allowedOriginsRaw;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    private Key signingKey;

    @PostConstruct
    void init() {
        if (jwtSecret == null || jwtSecret.isBlank()) return;
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length >= JWT_SECRET_MIN_BYTES) {
            this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        }
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = parseOrigins();
        HandshakeInterceptor interceptor = new JwtHandshakeInterceptor();

        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns(origins)
                .addInterceptors(interceptor)
                .withSockJS();

        registry.addEndpoint("/ws-planning")
                .setAllowedOriginPatterns(origins)
                .addInterceptors(interceptor)
                .withSockJS();

        log.info("WebSocket allowed origin patterns: {}", Arrays.toString(origins));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/sub", "/topic");
        registry.setApplicationDestinationPrefixes("/pub", "/app");
    }

    private String[] parseOrigins() {
        Set<String> set = new LinkedHashSet<>();
        if (allowedOriginsRaw != null && !allowedOriginsRaw.isBlank()) {
            Arrays.stream(allowedOriginsRaw.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(set::add);
        }
        if (frontendUrl != null && !frontendUrl.isBlank()) {
            set.add(frontendUrl.trim());
        }
        set.add(LOCAL_DEV_ORIGIN);
        return set.toArray(new String[0]);
    }

    /** 핸드셰이크 시 Authorization Bearer 또는 {@code ?token=} 쿼리에서 JWT 를 꺼내 검증. */
    private class JwtHandshakeInterceptor implements HandshakeInterceptor {
        @Override
        public boolean beforeHandshake(
                ServerHttpRequest request,
                ServerHttpResponse response,
                WebSocketHandler wsHandler,
                Map<String, Object> attributes) {
            if (signingKey == null) return true;
            try {
                String token = extractToken(request);
                if (token != null && !token.isBlank()) {
                    Claims claims =
                            Jwts.parserBuilder()
                                    .setSigningKey(signingKey)
                                    .build()
                                    .parseClaimsJws(token)
                                    .getBody();
                    attributes.put("userId", claims.getSubject());
                    attributes.put("role", claims.get("role", String.class));
                }
            } catch (Exception e) {
                log.debug("WS handshake JWT 검증 실패: {}", e.getClass().getSimpleName());
            }
            return true;
        }

        @Override
        public void afterHandshake(
                ServerHttpRequest request,
                ServerHttpResponse response,
                WebSocketHandler wsHandler,
                Exception exception) {
            // no-op
        }

        private String extractToken(ServerHttpRequest request) {
            if (!(request instanceof ServletServerHttpRequest servletReq)) return null;
            String auth = servletReq.getServletRequest().getHeader("Authorization");
            if (auth != null && auth.startsWith(BEARER_PREFIX)) {
                return auth.substring(BEARER_PREFIX.length());
            }
            return servletReq.getServletRequest().getParameter("token");
        }
    }
}
