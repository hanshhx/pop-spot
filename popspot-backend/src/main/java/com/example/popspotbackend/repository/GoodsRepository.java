package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Goods;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoodsRepository extends JpaRepository<Goods, Long> {
    // 팝업 ID로 굿즈 목록 조회
    List<Goods> findByPopupStore_Id(Long popupId);
}
