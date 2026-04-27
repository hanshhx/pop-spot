package com.example.popspotbackend.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
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

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * 변경 사항:
 * - setAllowedOriginPatterns("*") 제거 → 화이트리스트만 허용 (CSRF/도청 방어).
 * - 핸드셰이크 단계에서 JWT 검증 (선택적). 없으면 익명 통과 — 채팅 컨트롤러에서 접근 제어.
 *   (기존 익명 채팅이 동작하므로 호환을 위해 reject 하지 않음. 단 인증된 토큰이 있으면 user 정보를 attributes 에 담아 둠.)
 */
@Slf4j
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.allowed-origins:http://localhost:3000}")
    private String allowedOriginsRaw;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    private java.security.Key signingKey;

    @PostConstruct
    void init() {
        if (jwtSecret != null && !jwtSecret.isBlank()
                && jwtSecret.getBytes(StandardCharsets.UTF_8).length >= 32) {
            this.signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        }
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = parseOrigins();

        // setAllowedOriginPatterns: 와일드카드 허용 (https://*.vercel.app 같은 패턴) + credentials 호환.
        // SecurityConfig 와 동일 화이트리스트(APP_ALLOWED_ORIGINS) 사용.
        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns(origins)
                .addInterceptors(new JwtHandshakeInterceptor())
                .withSockJS();

        registry.addEndpoint("/ws-planning")
                .setAllowedOriginPatterns(origins)
                .addInterceptors(new JwtHandshakeInterceptor())
                .withSockJS();

        log.info("🛡️ WebSocket allowed origin patterns: {}", Arrays.toString(origins));
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
        set.add("http://localhost:3000");
        return set.toArray(new String[0]);
    }

    /** 핸드셰이크 시 ?token=... 또는 Authorization 헤더의 JWT 를 검증. */
    private class JwtHandshakeInterceptor implements HandshakeInterceptor {
        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Map<String, Object> attributes) {
            if (signingKey == null) return true; // dev 환경에서 시크릿 미설정 시 통과

            try {
                String token = null;
                if (request instanceof ServletServerHttpRequest servletReq) {
                    String auth = servletReq.getServletRequest().getHeader("Authorization");
                    if (auth != null && auth.startsWith("Bearer ")) {
                        token = auth.substring(7);
                    } else {
                        // SockJS 는 헤더를 못 보내므로 ?token=... 쿼리 지원
                        token = servletReq.getServletRequest().getParameter("token");
                    }
                }

                if (token != null && !token.isBlank()) {
                    var claims = Jwts.parserBuilder()
                            .setSigningKey(signingKey)
                            .build()
                            .parseClaimsJws(token)
                            .getBody();
                    attributes.put("userId", claims.getSubject());
                    attributes.put("role", claims.get("role", String.class));
                }
                // 토큰이 없거나 검증 실패해도 익명 채팅 호환을 위해 통과 — 메시지 발행 단에서 인증 체크.
                return true;
            } catch (Exception e) {
                log.debug("WS handshake JWT 검증 실패: {}", e.getClass().getSimpleName());
                return true;
            }
        }

        @Override
        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Exception exception) { /* no-op */ }
    }
}
