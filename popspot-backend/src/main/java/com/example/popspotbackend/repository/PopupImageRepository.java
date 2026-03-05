package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.PopupImage;
import com.example.popspotbackend.entity.PopupStore; // [로직] 부모 엔티티 참조를 위해 필요합니다.
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PopupImageRepository extends JpaRepository<PopupImage, Long> {
    //void deleteByPopupStore(PopupStore popupStore);
}