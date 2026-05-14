package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.GoodsRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 굿즈 조회 엔드포인트. 팝업별 굿즈와 메인용 랜덤 픽업 리스트를 제공한다. */
@RestController
@RequestMapping("/api/goods")
@RequiredArgsConstructor
public class GoodsController {

    private static final int RANDOM_PICK_LIMIT = 20;

    private final GoodsRepository goodsRepository;
    private final PopupStoreRepository popupStoreRepository;

    @GetMapping("/{popupId}")
    public ResponseEntity<List<Goods>> getGoodsByPopup(@PathVariable Long popupId) {
        return ResponseEntity.ok(goodsRepository.findByPopupStore_Id(popupId));
    }

    /** 메인 화면용 랜덤 굿즈. 데이터가 부족하면 그대로 전부 반환한다. */
    @GetMapping("/random")
    public ResponseEntity<List<Goods>> getRandomGoods() {
        List<Goods> shuffled = new ArrayList<>(goodsRepository.findAll());
        Collections.shuffle(shuffled);
        return ResponseEntity.ok(shuffled.subList(0, Math.min(shuffled.size(), RANDOM_PICK_LIMIT)));
    }

    @GetMapping("/stores")
    public ResponseEntity<List<PopupStore>> getPopupStores() {
        return ResponseEntity.ok(popupStoreRepository.findAll());
    }
}
