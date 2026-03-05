package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.PopupStore;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

// ✅ ID 타입을 String -> Long으로 변경하여 에러 해결
public interface PopupStoreRepository extends JpaRepository<PopupStore, Long> {

    // 1. 카테고리 필터링을 위한 메서드 (기존 코드 유지)
    List<PopupStore> findByCategory(String category);

    // 2. 조회수 높은 순서대로 상위 4개만 가져오는 메서드 (기존 코드 유지)
    List<PopupStore> findTop4ByOrderByViewCountDesc();

    // 3. 검색 기능 (기존 코드 유지)
    List<PopupStore> findByNameContainingOrLocationContaining(String name, String location);

    List<PopupStore> findByStatus(String status);
}