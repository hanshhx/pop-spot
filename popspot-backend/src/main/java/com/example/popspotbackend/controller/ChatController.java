package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.ChatMessage;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.ChatRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class ChatController {

    private final ChatRepository chatRepository;
    private final PopupStoreRepository popupStoreRepository;

    // 1. 실시간 메시지 전송 (🔥 에러 디버깅을 위해 로그/예외처리 추가됨)
    @MessageMapping("/chat/message/{roomId}")
    @SendTo("/sub/chat/room/{roomId}")
    public ChatMessage sendMessage(@DestinationVariable Long roomId, ChatMessageDto dto) {

        // [디버깅] 메시지가 컨트롤러까지 도착했는지 확인하는 로그
        System.out.println(">>> [채팅 수신] 방 번호(popupId): " + roomId + ", 메시지: " + dto.getMessage());

        try {
            // DB에서 팝업 정보를 찾습니다. (여기서 에러가 가장 많이 발생함)
            PopupStore popup = popupStoreRepository.findById(roomId)
                    .orElseThrow(() -> new RuntimeException("팝업 스토어 ID(" + roomId + ")가 DB에 존재하지 않습니다."));

            ChatMessage chat = new ChatMessage(popup, dto.getSender(), dto.getMessage());
            return chatRepository.save(chat);

        } catch (Exception e) {
            // [에러 확인] 어떤 문제인지 빨간 글씨로 콘솔에 출력합니다.
            System.err.println("❌ [채팅 에러 발생] " + e.getMessage());
            // 트랜잭션 롤백 등을 위해 에러를 다시 던집니다.
            throw e;
        }
    }

    // 2. 상세 페이지용 채팅 내역 (기존 로직 유지)
    @GetMapping("/api/chat/history/{roomId}")
    public List<ChatMessage> getChatHistory(@PathVariable Long roomId) {
        return chatRepository.findByPopupStore_IdOrderBySendTimeAsc(roomId);
    }

    // 3. 메인 페이지용 실시간 티커 (기존 로직 유지)
    @GetMapping("/api/chat/ticker")
    public List<Map<String, String>> getRecentChats() {
        List<ChatMessage> recents = chatRepository.findTop10ByOrderBySendTimeDesc();

        List<Map<String, String>> result = new ArrayList<>();
        for (ChatMessage msg : recents) {
            // 팝업 정보가 없는(Null) 옛날 데이터는 건너뜁니다.
            if (msg.getPopupStore() == null) {
                continue;
            }

            Map<String, String> map = new HashMap<>();
            map.put("popupName", msg.getPopupStore().getName()); // 팝업 이름
            map.put("popupId", String.valueOf(msg.getPopupStore().getId())); // 링크 이동용 ID
            map.put("sender", msg.getSender());
            map.put("message", msg.getMessage());
            result.add(map);
        }
        return result;
    }

    @lombok.Data
    public static class ChatMessageDto {
        private String sender;
        private String message;
    }
}