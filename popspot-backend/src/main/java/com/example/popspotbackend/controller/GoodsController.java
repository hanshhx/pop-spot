package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.service.GoodsService;
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

    @GetMapping("/{popupId}")
    public ResponseEntity<List<Goods>> getGoodsByPopup(@PathVariable Long popupId) {
        return ResponseEntity.ok(goodsService.findByPopup(popupId));
    }

    @GetMapping("/random")
    public ResponseEntity<List<Goods>> getRandomGoods() {
        return ResponseEntity.ok(goodsService.findRandomPicks());
    }

    /*
     * 보안: GET /api/goods/stores 를 제거하고 AdminController 의 GET /api/admin/goods/stores 로 옮겼다.
     *
     * 이 경로는 SecurityConfig 의 /api/** permitAll 에 걸려 무인증이었고 응답이 findAll() 이라 필터가
     * 하나도 없었다. 목록에서 숨긴 PENDING(미검수) · REJECTED · TAKEDOWN 팝업의 이름 · 위치 · 설명이
     * 누구에게나 그대로 나갔다 — 권리자 신고로 내린 정보가 이 엔드포인트로 계속 열람되던 셈이다.
     *
     * 용도가 원래 어드민 굿즈 등록 화면이므로 /api/admin/** 아래로 옮겨 URL 규칙과 클래스 단
     * @PreAuthorize 로 이중 방어한다. (/api/goods/admin/... 로 두면 URL 규칙에 안 걸린다.)
     * 프론트·앱 어디에도 호출처가 없어 기능 손실은 없다.
     */
}
