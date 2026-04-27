package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.GoodsRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/goods")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class GoodsController {

    private final GoodsRepository goodsRepository;
    private final PopupStoreRepository popupStoreRepository;

    // 1. [기존] 특정 팝업의 굿즈 보기
    @GetMapping("/{popupId}")
    public ResponseEntity<List<Goods>> getGoodsByPopup(@PathVariable Long popupId) {
        return ResponseEntity.ok(goodsRepository.findByPopupStore_Id(popupId));
    }

    // 2. [추가] 전체 굿즈 랜덤 20개 보기 (메인용)
    @GetMapping("/random")
    public ResponseEntity<List<Goods>> getRandomGoods() {
        List<Goods> all = goodsRepository.findAll();
        Collections.shuffle(all);
        // 데이터가 적으면 전체 반환, 많으면 20개만
        return ResponseEntity.ok(all.subList(0, Math.min(all.size(), 20)));
    }

    // 3. [추가] 팝업스토어 목록 가져오기 (필터링용)
    @GetMapping("/stores")
    public ResponseEntity<List<PopupStore>> getPopupStores() {
        return ResponseEntity.ok(popupStoreRepository.findAll());
    }
}