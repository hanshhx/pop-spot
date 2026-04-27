package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MateChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MateChatMessageRepository extends JpaRepository<MateChatMessage, Long> {
    // 🔥 특정 게시글 ID로 메시지 목록을 찾고 시간순으로 정렬하는 메서드
    List<MateChatMessage> findByMatePostIdOrderBySendTimeAsc(Long postId);
}