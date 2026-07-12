package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.ChatMessage;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.ChatRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팝업 상세 채팅 + 메인 페이지 티커 도메인 서비스.
 *
 * <p>STOMP 핸들러 / REST 컨트롤러가 직접 Repository 를 다루지 않도록 영속화 · 조회 · DTO 변환을 모두 위임받는다.
 */
@Service
@RequiredArgsConstructor
public class ChatService {

    private static final int TICKER_LIMIT = 10;

    private final ChatRepository chatRepository;
    private final PopupStoreService popupStoreService;

    /** STOMP 채팅 송신 — popupId 검증 + 메시지 저장. */
    @Transactional
    public ChatMessage saveMessage(Long popupId, String sender, String message) {
        PopupStore popup = popupStoreService.findOrThrow(popupId);
        return chatRepository.save(new ChatMessage(popup, sender, message));
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> findChatHistory(Long popupId) {
        return chatRepository.findByPopupStore_IdOrderBySendTimeAsc(popupId);
    }

    /** 메인 페이지 티커 — orphan 메시지 (팝업 삭제됨) 는 노출하지 않는다. */
    @Transactional(readOnly = true)
    public List<Map<String, String>> findRecentTickerEntries() {
        List<ChatMessage> recents = chatRepository.findTop10ByOrderBySendTimeDesc();
        List<Map<String, String>> result = new ArrayList<>(TICKER_LIMIT);
        for (ChatMessage msg : recents) {
            if (msg.getPopupStore() == null) continue;
            result.add(toTickerEntry(msg));
        }
        return result;
    }

    /** 어드민 — 최근 라이브 댓글(채팅) 목록. 부적절한 댓글 삭제 대상 선택용. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> findRecentMessages() {
        List<ChatMessage> recents = chatRepository.findTop100ByOrderBySendTimeDesc();
        List<Map<String, Object>> result = new ArrayList<>(recents.size());
        for (ChatMessage m : recents) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", m.getId());
            map.put("sender", m.getSender());
            map.put("message", m.getMessage());
            map.put("sendTime", m.getSendTime());
            map.put("popupName", m.getPopupStore() != null ? m.getPopupStore().getName() : null);
            map.put("popupId", m.getPopupStore() != null ? m.getPopupStore().getId() : null);
            result.add(map);
        }
        return result;
    }

    /** 어드민 — 부적절한 라이브 댓글 삭제. */
    @Transactional
    public void deleteMessage(Long id) {
        chatRepository.deleteById(id);
    }

    /* ============================== 내부 헬퍼 ============================== */

    private Map<String, String> toTickerEntry(ChatMessage msg) {
        Map<String, String> entry = new HashMap<>();
        entry.put("popupName", msg.getPopupStore().getName());
        entry.put("popupId", String.valueOf(msg.getPopupStore().getId()));
        entry.put("sender", msg.getSender());
        entry.put("message", msg.getMessage());
        return entry;
    }
}
