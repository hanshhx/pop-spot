package com.example.popspotbackend.config;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

/**
 * 지금 열려 있는 실시간 연결을 사용자별로 들고 있는다. "모든 기기에서 로그아웃" 이 <b>이미 열린 연결까지</b> 끊기 위해 필요하다.
 *
 * <p><b>왜 이게 없으면 안 되는가.</b> {@code tokenVersion} 을 올리면 앞으로의 HTTP 요청과 새 연결은 즉시 막힌다. 그런데 WebSocket 의
 * 토큰 검사는 <b>연결할 때 한 번</b>만 돈다. 이미 연결된 세션은 그 뒤로 아무도 토큰을 다시 보지 않으므로, 세션을 끊기 전까지 계속 메시지를 주고받는다.
 *
 * <p>즉 토큰이 샜다고 판단해 비상 스위치를 눌러도, 공격자가 이미 열어 둔 연결은 살아 있다. 채팅을 계속 보낼 수 있고 구독한 채널의 메시지도 계속 받는다. "끊었다" 고
 * 믿는 것과 실제가 어긋나는 것이 이 기능에서 가장 위험한 상태다.
 *
 * <p>메모리에만 둔다. 서버가 여러 대가 되면 자기 서버의 연결만 끊게 되므로 그때는 Redis 로 신호를 돌려야 한다 — 지금은 한 대다.
 */
@Slf4j
@Component
public class LiveConnectionRegistry {

    /** WebSocket 세션 id → 세션 본체. 끊으려면 세션 객체가 필요하다. */
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    /** 사용자 id → 그 사용자의 WebSocket 세션 id 들. 한 사람이 여러 기기로 붙을 수 있다. */
    private final Map<String, Set<String>> byUser = new ConcurrentHashMap<>();

    /** 연결이 열렸다. 아직 누구인지 모른다 — STOMP CONNECT 에서 인증이 끝나야 안다. */
    public void register(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    /** 인증이 끝나 주인이 밝혀졌다. */
    public void bind(String userId, String sessionId) {
        if (userId == null || sessionId == null) return;
        byUser.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
    }

    /** 연결이 닫혔다. 양쪽 지도에서 지운다. */
    public void unregister(String sessionId) {
        sessions.remove(sessionId);
        byUser.values().forEach(ids -> ids.remove(sessionId));
        byUser.entrySet().removeIf(e -> e.getValue().isEmpty());
    }

    /**
     * 이 사용자의 열린 연결을 전부 끊는다.
     *
     * @return 끊은 연결 수
     */
    public int disconnectUser(String userId) {
        Set<String> ids = byUser.remove(userId);
        if (ids == null || ids.isEmpty()) return 0;

        int closed = 0;
        for (String id : ids) {
            WebSocketSession session = sessions.remove(id);
            if (session == null || !session.isOpen()) continue;
            try {
                // NORMAL 이 아니라 정책 위반으로 닫는다 — 클라이언트가 "그냥 끊겼네" 하고
                // 자동 재연결하는 대신 재로그인이 필요한 상황임을 구분할 수 있게 한다.
                session.close(CloseStatus.POLICY_VIOLATION);
                closed++;
            } catch (IOException | RuntimeException e) {
                // 이미 닫히는 중일 수 있다. 하나가 실패해도 나머지는 끊어야 한다.
                log.debug("[세션폐기] 연결 종료 실패 — sessionId={} 원인={}", id, e.getClass().getSimpleName());
            }
        }
        return closed;
    }
}
