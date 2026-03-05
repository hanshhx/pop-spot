package com.example.popspotbackend.config;

import com.example.popspotbackend.controller.PlanningController;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate redisTemplate;

    // 사용자가 연결을 끊었을 때 (탭 닫기, 네트워크 오류 등) 실행됨
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        String sessionKey = PlanningController.SESSION_KEY_PREFIX + sessionId;

        // 1. 이 세션 ID로 저장된 정보가 있는지 확인
        String sessionValue = redisTemplate.opsForValue().get(sessionKey);

        if (sessionValue != null) {
            // 저장 형식: "roomId/nickname|color"
            String[] parts = sessionValue.split("/");
            if (parts.length == 2) {
                String roomId = parts[0];
                String userData = parts[1]; // nickname|color

                log.info("User Disconnected: {}, Room: {}", userData, roomId);

                // 2. 방 참여자 목록(Redis Set)에서 제거
                redisTemplate.opsForSet().remove("plan:room:" + roomId + ":users", userData);

                // 3. 해당 방의 다른 사람들에게 "LEAVE" 메시지 전송
                PlanningController.PlanAction leaveAction = new PlanningController.PlanAction("LEAVE", userData, "System");
                messagingTemplate.convertAndSend("/topic/plan/" + roomId, leaveAction);

                // 4. 세션 정보 삭제
                redisTemplate.delete(sessionKey);
            }
        }
    }
}