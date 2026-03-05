package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Stamp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

// [로직 해석] JpaRepository를 상속받아 Stamp 엔티티에 대한 데이터베이스 CRUD(생성,조회,수정,삭제) 작업을 수행합니다.
@Repository
public interface StampRepository extends JpaRepository<Stamp, Long> {

    // 🔥 [임의 추가 (에러 해결용)] 특정 유저가 오늘 하루 동안 어디든 스탬프를 찍었는지 검사하는 쿼리 메서드입니다.
    boolean existsByUserIdAndStampDateBetween(String userId, LocalDateTime startOfDay, LocalDateTime endOfDay);

    // 🔥 [임의 추가 (에러 해결용)] 특정 유저가 이 특정 팝업스토어(popupStore_Id)에 스탬프를 찍은 적이 있는지 영구 중복을 검사합니다.
    boolean existsByUserIdAndPopupStore_Id(String userId, Long popupId);

    // 🔥 [임의 추가 (에러 해결용)] 특정 유저(userId)가 획득한 모든 스탬프 기록을 리스트 형태로 불러옵니다.
    List<Stamp> findAllByUserId(String userId);
}