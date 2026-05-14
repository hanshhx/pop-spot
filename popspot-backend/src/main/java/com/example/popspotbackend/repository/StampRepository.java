package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Stamp;
// 🔥 [임의 수정] EntityGraph를 쓰기 위한 임포트
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

// [로직 해석] JpaRepository를 상속받아 Stamp 엔티티에 대한 데이터베이스 CRUD(생성,조회,수정,삭제) 작업을 수행합니다.
@Repository
public interface StampRepository extends JpaRepository<Stamp, Long> {

    // 🔥 [임의 추가 (에러 해결용)] 특정 유저가 오늘 하루 동안 어디든 스탬프를 찍었는지 검사하는 쿼리 메서드입니다.
    boolean existsByUserIdAndStampDateBetween(
            String userId, LocalDateTime startOfDay, LocalDateTime endOfDay);

    // 🔥 [임의 추가 (에러 해결용)] 특정 유저가 이 특정 팝업스토어(popupStore_Id)에 스탬프를 찍은 적이 있는지 영구 중복을 검사합니다.
    boolean existsByUserIdAndPopupStore_Id(String userId, Long popupId);

    // 🔥 [수정] popupStore 만 가져오면 PopupStore.getImageUrl() 이 lazy 로 images 를 또 로드함 → 세션 닫힌 상태에서
    // LazyInitException.
    //         popupStore.images 까지 한 번에 fetch (open-in-view=false 와 호환).
    @EntityGraph(attributePaths = {"popupStore", "popupStore.images"})
    List<Stamp> findAllByUserId(String userId);

    // 🔥 [21번 임의 수정] 메모리 폭발을 막기 위해, 스탬프 전체 데이터를 끌어오지 않고 DB에서 숫자(개수)만 셉니다.
    int countByUserId(String userId);
}
