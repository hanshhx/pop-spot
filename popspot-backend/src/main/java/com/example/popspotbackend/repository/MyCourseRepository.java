package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.MyCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MyCourseRepository extends JpaRepository<MyCourse, Long> {

    // 🔥 [이 부분이 빠져 있어서 에러가 난 것입니다]
    // Spring Data JPA가 메서드 이름을 보고 자동으로 쿼리를 만들어줍니다.
    // (select * from my_course where user_id = :userId)
    List<MyCourse> findAllByUserId(String userId);
}