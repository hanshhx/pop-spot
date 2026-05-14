package com.example.popspotbackend.config;

import com.example.popspotbackend.controller.PlanningController;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * 일정 협업 룸에서 사용자가 연결을 끊었을 때 (탭 닫기 / 네트워크 오류 등) 후처리.
 *
 * <p>참여자 Set 에서 제거하고 같은 방의 다른 사람들에게 {@code LEAVE} 메시지를 브로드캐스트한 뒤 세션 키를 정리한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private static final String ACTION_LEAVE = "LEAVE";
    private static final String SYSTEM_SENDER = "System";
    private static final String SESSION_VALUE_DELIMITER = "/";
    private static final int EXPECTED_SESSION_PARTS = 2;
    private static final String ROOM_USERS_KEY_PREFIX = "plan:room:";
    private static final String ROOM_USERS_KEY_SUFFIX = ":users";
    private static final String TOPIC_PLAN_PREFIX = "/topic/plan/";

    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate redisTemplate;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        String sessionKey = PlanningController.SESSION_KEY_PREFIX + sessionId;

        String sessionValue = redisTemplate.opsForValue().get(sessionKey);
        if (sessionValue == null) return;

        String[] parts = sessionValue.split(SESSION_VALUE_DELIMITER);
        if (parts.length != EXPECTED_SESSION_PARTS) return;

        String roomId = parts[0];
        String userData = parts[1];
        log.info("User Disconnected: {}, Room: {}", userData, roomId);

        evictFromRoom(roomId, userData);
        broadcastLeave(roomId, userData);
        redisTemplate.delete(sessionKey);
    }

    private void evictFromRoom(String roomId, String userData) {
        redisTemplate
                .opsForSet()
                .remove(ROOM_USERS_KEY_PREFIX + roomId + ROOM_USERS_KEY_SUFFIX, userData);
    }

    private void broadcastLeave(String roomId, String userData) {
        messagingTemplate.convertAndSend(
                TOPIC_PLAN_PREFIX + roomId,
                new PlanningController.PlanAction(ACTION_LEAVE, userData, SYSTEM_SENDER));
    }
}
