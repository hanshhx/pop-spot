package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.Stamp;
import com.example.popspotbackend.service.StampService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 팝업 방문 스탬프 적립 API. 중복 적립은 서비스 계층의 unique 제약으로 차단된다. */
@Slf4j
@RestController
@RequestMapping("/api/stamps")
@RequiredArgsConstructor
public class StampController {

    private final StampService stampService;

    @PostMapping
    public ResponseEntity<String> addStamp(
            @RequestParam("userId") String userId, @RequestParam("popupId") Long popupId) {
        log.debug("[Stamp] 적립 시도 userId={} popupId={}", userId, popupId);
        try {
            stampService.addStamp(userId, popupId);
            return ResponseEntity.ok("스탬프 획득 성공 (팝업 ID: " + popupId + ")");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("처리 실패: " + e.getMessage());
        }
    }

    @GetMapping("/my")
    public ResponseEntity<List<Stamp>> getMyStamps(@RequestParam String userId) {
        return ResponseEntity.ok(stampService.getMyStamps(userId));
    }
}
