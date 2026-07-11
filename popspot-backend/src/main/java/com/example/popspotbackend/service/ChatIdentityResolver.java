package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * 실시간 채팅에서 '보낸 이(sender)' 를 서버가 확정한다.
 *
 * <p>기존에는 클라이언트가 payload 로 보낸 sender 를 그대로 저장해, 로그인 없이 아무 이름이나(심지어 타 회원·운영자)
 * 사칭할 수 있었다. 핸드셰이크({@code WebSocketConfig.JwtHandshakeInterceptor})가 JWT 를 검증해 세션에 넣어 둔
 * {@code userId} 로 실제 닉네임을 강제하고, 인증되지 않은 연결은 "익명" 으로 고정한다. 클라이언트가 보낸 sender 는
 * 신뢰하지 않는다. 세션당 최초 1회만 조회하고 캐시한다.
 */
@Component
@RequiredArgsConstructor
public class ChatIdentityResolver {

    private static final String ANONYMOUS = "익명";
    private static final String ATTR_USER_ID = "userId";
    private static final String ATTR_RESOLVED = "resolvedSender";

    private final UserRepository userRepository;

    /** 세션의 userId 로 실제 닉네임을 강제. 미인증 연결은 "익명". */
    public String resolveSender(SimpMessageHeaderAccessor headerAccessor) {
        Map<String, Object> attrs = headerAccessor.getSessionAttributes();
        if (attrs == null) return ANONYMOUS;

        Object cached = attrs.get(ATTR_RESOLVED);
        if (cached instanceof String s) return s;

        String resolved = ANONYMOUS;
        Object userId = attrs.get(ATTR_USER_ID);
        if (userId != null) {
            resolved =
                    userRepository
                            .findById(userId.toString())
                            .map(User::getNickname)
                            .filter(n -> n != null && !n.isBlank())
                            .orElse(ANONYMOUS);
        }
        attrs.put(ATTR_RESOLVED, resolved);
        return resolved;
    }
}
