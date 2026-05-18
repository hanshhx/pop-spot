package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.ChatMessage;
import com.example.popspotbackend.service.ChatService;
import java.util.List;
import java.util.Map;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
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

    @MessageMapping("/chat/message/{roomId}")
    @SendTo("/sub/chat/room/{roomId}")
    public ChatMessage sendMessage(@DestinationVariable Long roomId, ChatMessageDto dto) {
        log.debug("[Chat] roomId={} sender={} 수신", roomId, dto.getSender());
        return chatService.saveMessage(roomId, dto.getSender(), dto.getMessage());
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
