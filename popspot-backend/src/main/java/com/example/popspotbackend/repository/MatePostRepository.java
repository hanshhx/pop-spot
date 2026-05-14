package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MatePost;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatePostRepository extends JpaRepository<MatePost, Long> {
    // 최신순 정렬해서 가져오기
    List<MatePost> findAllByOrderByIsMegaphoneDescCreatedAtDesc();

    int countByAuthor_UserId(String userId);
}
