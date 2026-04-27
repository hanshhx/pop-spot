package com.example.popspotbackend.repository;

// 🔥 [수정] domain -> entity 로 변경
import com.example.popspotbackend.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatRepository extends JpaRepository<ChatMessage, Long> {
    // 1. 특정 방의 채팅 내역 (상세페이지용) - 변경됨 (popupStore.id로 조회)
    List<ChatMessage> findByPopupStore_IdOrderBySendTimeAsc(Long roomId);

    // 2. 전체 채팅 중 최신 10개 (메인페이지 티커용)
    List<ChatMessage> findTop10ByOrderBySendTimeDesc();

    int countBySender(String sender);
}