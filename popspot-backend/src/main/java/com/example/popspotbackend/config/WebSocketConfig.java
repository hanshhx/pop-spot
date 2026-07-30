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

    /**
     * 브로커 주소 — <b>클라이언트가 여기로 직접 보내면 안 된다.</b>
     *
     * <p>STOMP 는 SEND 목적지가 브로커 주소여도 그대로 받아 구독자에게 중계한다. 즉 클라이언트가 {@code /sub/chat/room/12} 로 SEND 하면
     * <b>컨트롤러를 통째로 우회</b>해 그 방을 보고 있는 모든 사람의 화면에 임의 메시지를 띄울 수 있다. 보낸 사람 확정·내용 검증·DB 저장이 전부 건너뛰어지므로
     * 조작된 시스템 메시지나 남의 이름으로 된 채팅, 가짜 투표 결과를 심을 수 있다.
     *
     * <p>브로커 주소는 <b>구독 전용</b>이고, 클라이언트가 보내는 것은 아래 {@link #CLIENT_SEND_PREFIXES} 뿐이다. 이 둘을 나누지 않으면
     * 컨트롤러의 모든 검증이 우회 가능한 장식이 된다.
     */
    private static final String[] BROKER_PREFIXES = {"/sub", "/topic"};

    /** 클라이언트 전송이 허용되는 주소. {@code setApplicationDestinationPrefixes} 와 같아야 한다. */
    private static final String[] CLIENT_SEND_PREFIXES = {"/pub", "/app"};

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
        // 같은 상수를 쓴다 — 여기와 인터셉터의 목록이 어긋나면 검사에 구멍이 생긴다.
        registry.enableSimpleBroker(BROKER_PREFIXES);
        registry.setApplicationDestinationPrefixes(CLIENT_SEND_PREFIXES);
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
            if (StompCommand.SEND.equals(accessor.getCommand())) {
                // 순서가 중요하다 — 목적지 검사를 레이트리밋보다 먼저 한다. 뒤에 두면 위조 시도가
                // 정상 요청과 같은 한도를 갉아먹어, 공격자가 남의 전송을 막는 수단이 된다.
                rejectBrokerDestination(accessor);
                enforceSendRate(accessor);
            }
            if (StompCommand.SEND.equals(accessor.getCommand())
                    || StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                authorizeMateDestination(accessor);
            }
            return message;
        }

        /**
         * 클라이언트 SEND 목적지를 검사한다.
         *
         * <p>브로커 주소({@code /sub}, {@code /topic})로 보내는 것은 무조건 거부한다 — 그쪽은 구독 전용이고, 직접 보내면 컨트롤러의 검증을
         * 통째로 우회한다.
         *
         * <p>허용 목록을 <b>따로 확인</b>하는 이유: 브로커 주소만 막으면 새 브로커 접두어를 추가할 때 이 목록을 함께 고쳐야 한다는 걸 잊기 쉽다. 보낼 수
         * 있는 곳을 명시하면 모르는 주소는 기본 거부가 되어, 빠뜨려도 열리는 쪽이 아니라 막히는 쪽으로 실패한다.
         */
        private void rejectBrokerDestination(StompHeaderAccessor accessor) {
            String destination = accessor.getDestination();
            if (destination == null) return;

            for (String broker : BROKER_PREFIXES) {
                if (destination.equals(broker) || destination.startsWith(broker + "/")) {
                    log.warn("[WS] 브로커 주소로의 직접 전송 거부: {}", destination);
                    throw new SecurityException("이 주소로는 메시지를 보낼 수 없습니다.");
                }
            }
            for (String allowed : CLIENT_SEND_PREFIXES) {
                if (destination.equals(allowed) || destination.startsWith(allowed + "/")) return;
            }
            log.warn("[WS] 허용되지 않은 전송 주소 거부: {}", destination);
            throw new SecurityException("이 주소로는 메시지를 보낼 수 없습니다.");
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
