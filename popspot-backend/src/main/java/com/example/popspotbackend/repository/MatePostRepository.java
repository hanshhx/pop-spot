package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MatePost;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MatePostRepository extends JpaRepository<MatePost, Long> {
    /**
     * 사용자 화면용 — 숨김 처리된 글 제외. v2.18.1 부터 신고 누적 자동 차단 글이 안 보이게.
     */
    @Query(
            "SELECT m FROM MatePost m WHERE m.isHidden = false "
                    + "ORDER BY m.isMegaphone DESC, m.createdAt DESC")
    List<MatePost> findAllByOrderByIsMegaphoneDescCreatedAtDesc();

    int countByAuthor_UserId(String userId);
}
