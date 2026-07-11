package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.ChatMessage;
import com.example.popspotbackend.service.ChatIdentityResolver;
import com.example.popspotbackend.service.ChatService;
import java.util.List;
import java.util.Map;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 팝업 상세 페이지의 실시간 채팅 + 메인 페이지 티커.
 *
 * <p>STOMP: {@code /pub/chat/message/{popupId}} → {@code /sub/chat/room/{popupId}}. 영속화 · 티커 집계는
 * {@link ChatService} 가 담당하고, 컨트롤러는 라우팅 + DTO 매핑만 한다.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ChatIdentityResolver identityResolver;

    @MessageMapping("/chat/message/{roomId}")
    @SendTo("/sub/chat/room/{roomId}")
    public ChatMessage sendMessage(
            @DestinationVariable Long roomId,
            ChatMessageDto dto,
            SimpMessageHeaderAccessor headerAccessor) {
        // 보안: sender 는 클라이언트 값(dto)을 신뢰하지 않고 인증 세션 기준으로 서버가 확정(사칭 차단).
        String sender = identityResolver.resolveSender(headerAccessor);
        log.debug("[Chat] roomId={} sender={} 수신", roomId, sender);
        return chatService.saveMessage(roomId, sender, dto.getMessage());
    }

    @GetMapping("/api/chat/history/{roomId}")
    public List<ChatMessage> getChatHistory(@PathVariable Long roomId) {
        return chatService.findChatHistory(roomId);
    }

    @GetMapping("/api/chat/ticker")
    public List<Map<String, String>> getRecentChats() {
        return chatService.findRecentTickerEntries();
    }

    @Data
    public static class ChatMessageDto {
        private String sender;
        private String message;
    }
}
