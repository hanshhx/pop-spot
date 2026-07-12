package com.example.popspotbackend.repository;

// 🔥 [수정] domain -> entity 로 변경
import com.example.popspotbackend.entity.ChatMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatRepository extends JpaRepository<ChatMessage, Long> {
    // 1. 특정 방의 채팅 내역 (상세페이지용) - 변경됨 (popupStore.id로 조회)
    List<ChatMessage> findByPopupStore_IdOrderBySendTimeAsc(Long roomId);

    // 2. 전체 채팅 중 최신 10개 (메인페이지 티커용)
    List<ChatMessage> findTop10ByOrderBySendTimeDesc();

    /** 어드민 라이브 댓글 관리 — 최근 100건. */
    List<ChatMessage> findTop100ByOrderBySendTimeDesc();

    /**
     * 어드민 개별/일괄 삭제 — 엔티티 로드 없이 SQL 로 바로 삭제. deleteById 는 로드를 거치므로 같은 id 행이 중복이면
     * (시퀀스 리셋으로 PK 충돌 이력) "Duplicate row" 로 터졌음. 벌크 delete 는 중복이 있어도 전부 안전하게 지운다.
     */
    @Modifying
    @Query("delete from ChatMessage m where m.id in :ids")
    int deleteAllByIdsBulk(@Param("ids") List<Long> ids);

    int countBySender(String sender);
}
