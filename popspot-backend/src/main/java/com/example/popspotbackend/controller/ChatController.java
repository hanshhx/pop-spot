package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.ChatMessage;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.ChatRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.util.ArrayList;
import java.util.HashMap;
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
 * <p>STOMP: {@code /pub/chat/message/{popupId}} → {@code /sub/chat/room/{popupId}}. 티커는 최근 10건 중 팝업
 * 매핑이 살아있는 메시지만 보여준다 (예전 orphan row 회피).
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class ChatController {

    private static final int TICKER_LIMIT = 10;

    private final ChatRepository chatRepository;
    private final PopupStoreRepository popupStoreRepository;

    @MessageMapping("/chat/message/{roomId}")
    @SendTo("/sub/chat/room/{roomId}")
    public ChatMessage sendMessage(@DestinationVariable Long roomId, ChatMessageDto dto) {
        log.debug("[Chat] roomId={} sender={} 수신", roomId, dto.getSender());
        PopupStore popup =
                popupStoreRepository
                        .findById(roomId)
                        .orElseThrow(
                                () ->
                                        new RuntimeException(
                                                "팝업 스토어 ID(" + roomId + ")가 DB에 존재하지 않습니다."));
        return chatRepository.save(new ChatMessage(popup, dto.getSender(), dto.getMessage()));
    }

    @GetMapping("/api/chat/history/{roomId}")
    public List<ChatMessage> getChatHistory(@PathVariable Long roomId) {
        return chatRepository.findByPopupStore_IdOrderBySendTimeAsc(roomId);
    }

    /** 메인 페이지 티커. 팝업이 사라진 orphan 메시지는 노출하지 않는다. */
    @GetMapping("/api/chat/ticker")
    public List<Map<String, String>> getRecentChats() {
        List<ChatMessage> recents = chatRepository.findTop10ByOrderBySendTimeDesc();
        List<Map<String, String>> result = new ArrayList<>(TICKER_LIMIT);
        for (ChatMessage msg : recents) {
            if (msg.getPopupStore() == null) continue;
            result.add(toTickerEntry(msg));
        }
        return result;
    }

    private Map<String, String> toTickerEntry(ChatMessage msg) {
        Map<String, String> entry = new HashMap<>();
        entry.put("popupName", msg.getPopupStore().getName());
        entry.put("popupId", String.valueOf(msg.getPopupStore().getId()));
        entry.put("sender", msg.getSender());
        entry.put("message", msg.getMessage());
        return entry;
    }

    @Data
    public static class ChatMessageDto {
        private String sender;
        private String message;
    }
}
