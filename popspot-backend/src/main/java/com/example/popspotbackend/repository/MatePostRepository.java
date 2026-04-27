package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MatePost;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MatePostRepository extends JpaRepository<MatePost, Long> {
    // 최신순 정렬해서 가져오기
    List<MatePost> findAllByOrderByIsMegaphoneDescCreatedAtDesc();
    int countByAuthor_UserId(String userId);
}