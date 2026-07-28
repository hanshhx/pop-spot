package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MateChatMessage;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MateChatMessageRepository extends JpaRepository<MateChatMessage, Long> {
    // 🔥 특정 게시글 ID로 메시지 목록을 찾고 시간순으로 정렬하는 메서드
    List<MateChatMessage> findByMatePostIdOrderBySendTimeAsc(Long postId);

    void deleteBySender(String sender);

    void deleteByMatePost_IdIn(Collection<Long> matePostIds);

    /**
     * 탈퇴 처리에서 지울 첨부 파일 경로를 모은다(v2.47).
     *
     * <p>행을 지우기 <b>전에</b> 불러야 한다 — {@code deleteBySender} 로 먼저 지우면 어떤 파일이 이 사람
     * 것이었는지 알 방법이 사라져, 디스크에 주인 없는 이미지가 영영 남는다.
     */
    @Query(
            "SELECT m.fileUrl FROM MateChatMessage m "
                    + "WHERE m.sender = :sender AND m.fileUrl IS NOT NULL AND m.fileUrl <> ''")
    List<String> findFileUrlsBySender(@Param("sender") String sender);

    /** 위와 같은 목적. 방이 통째로 삭제될 때 그 방의 첨부도 함께 지운다. */
    @Query(
            "SELECT m.fileUrl FROM MateChatMessage m "
                    + "WHERE m.matePost.id IN :matePostIds "
                    + "AND m.fileUrl IS NOT NULL AND m.fileUrl <> ''")
    List<String> findFileUrlsByMatePostIds(@Param("matePostIds") Collection<Long> matePostIds);
}
