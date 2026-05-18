package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.GoodsService;
import com.example.popspotbackend.service.PopupStoreService;
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

    private final GoodsService goodsService;
    private final PopupStoreService popupStoreService;

    @GetMapping("/{popupId}")
    public ResponseEntity<List<Goods>> getGoodsByPopup(@PathVariable Long popupId) {
        return ResponseEntity.ok(goodsService.findByPopup(popupId));
    }

    @GetMapping("/random")
    public ResponseEntity<List<Goods>> getRandomGoods() {
        return ResponseEntity.ok(goodsService.findRandomPicks());
    }

    /** 굿즈 등록 페이지에서 팝업 선택을 위해 사용. */
    @GetMapping("/stores")
    public ResponseEntity<List<PopupStore>> getPopupStores() {
        return ResponseEntity.ok(popupStoreService.findAll());
    }
}
