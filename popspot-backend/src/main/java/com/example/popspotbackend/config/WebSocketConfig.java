package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.MateService;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

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
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final int JWT_SECRET_MIN_BYTES = 32;
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String LOCAL_DEV_ORIGIN = "http://localhost:3000";
    private static final Pattern MATE_DESTINATION =
            Pattern.compile("/(?:sub|pub)/mate/chat/(\\d+)$");
    private static final int MAX_SENDS_PER_MINUTE = 40;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.allowed-origins:http://localhost:3000}")
    private String allowedOriginsRaw;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    private final MateService mateService;
    private final UserRepository userRepository;

    private final Cache<String, AtomicInteger> sendCounters =
            Caffeine.newBuilder()
                    .maximumSize(100_000)
                    .expireAfterWrite(java.time.Duration.ofMinutes(1))
                    .build();

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
        registry.addEndpoint("/ws-stomp").setAllowedOriginPatterns(origins).withSockJS();

        registry.addEndpoint("/ws-planning").setAllowedOriginPatterns(origins).withSockJS();

        log.info("WebSocket allowed origin patterns: {}", Arrays.toString(origins));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/sub", "/topic");
        registry.setApplicationDestinationPrefixes("/pub", "/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new AuthenticatedStompInterceptor());
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
        if (!"prod".equalsIgnoreCase(activeProfile)) set.add(LOCAL_DEV_ORIGIN);
        return set.toArray(new String[0]);
    }

    /** STOMP CONNECT 헤더로 인증하고 동행 채널의 구독·발행 권한을 검사한다. */
    private class AuthenticatedStompInterceptor implements ChannelInterceptor {
        @Override
        public Message<?> preSend(Message<?> message, MessageChannel channel) {
            StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
            if (StompCommand.CONNECT.equals(accessor.getCommand())) authenticate(accessor);
            if (StompCommand.SEND.equals(accessor.getCommand())) enforceSendRate(accessor);
            if (StompCommand.SEND.equals(accessor.getCommand())
                    || StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                authorizeMateDestination(accessor);
            }
            return message;
        }

        private void authenticate(StompHeaderAccessor accessor) {
            String auth = accessor.getFirstNativeHeader("Authorization");
            if (auth == null || auth.isBlank()) return;
            if (!auth.startsWith(BEARER_PREFIX) || signingKey == null) {
                throw new SecurityException("유효하지 않은 WebSocket 인증입니다.");
            }
            try {
                Claims claims =
                        Jwts.parserBuilder()
                                .setSigningKey(signingKey)
                                .build()
                                .parseClaimsJws(auth.substring(BEARER_PREFIX.length()))
                                .getBody();
                String userId = claims.getSubject();
                String role = claims.get("role", String.class);
                if (userId == null || role == null) throw new SecurityException("JWT claim 누락");
                User user = userRepository.findById(userId).orElse(null);
                Number tokenVersion = claims.get("ver", Number.class);
                if (user == null
                        || !user.isAccountActive()
                        || tokenVersion == null
                        || tokenVersion.longValue() != user.getTokenVersion()) {
                    throw new SecurityException("만료되거나 철회된 사용자 세션");
                }
                if (userId == null || role == null) throw new SecurityException("JWT claim 누락");
                String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
                accessor.setUser(
                        new UsernamePasswordAuthenticationToken(
                                userId,
                                null,
                                Collections.singletonList(new SimpleGrantedAuthority(authority))));
                Map<String, Object> attrs = accessor.getSessionAttributes();
                if (attrs != null) {
                    attrs.put("userId", userId);
                    attrs.put("role", authority);
                }
            } catch (RuntimeException e) {
                log.debug("STOMP JWT 검증 실패: {}", e.getClass().getSimpleName());
                throw new SecurityException("WebSocket 인증이 만료되었거나 유효하지 않습니다.");
            }
        }

        private void authorizeMateDestination(StompHeaderAccessor accessor) {
            String destination = accessor.getDestination();
            if (destination == null) return;
            Matcher matcher = MATE_DESTINATION.matcher(destination);
            if (!matcher.matches()) return;
            String userId = accessor.getUser() == null ? null : accessor.getUser().getName();
            Long postId = Long.valueOf(matcher.group(1));
            if (!mateService.isParticipant(postId, userId)) {
                throw new SecurityException("동행 참여자만 채팅 채널에 접근할 수 있습니다.");
            }
        }

        private void enforceSendRate(StompHeaderAccessor accessor) {
            String sessionId = accessor.getSessionId();
            String destination = accessor.getDestination();
            String key = (sessionId == null ? "unknown" : sessionId) + "|" + destination;
            int count = sendCounters.get(key, ignored -> new AtomicInteger()).incrementAndGet();
            if (count > MAX_SENDS_PER_MINUTE) {
                throw new SecurityException("메시지 전송 한도를 초과했습니다.");
            }
        }
    }
}
