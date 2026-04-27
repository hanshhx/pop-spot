package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.Stamp;
import com.example.popspotbackend.service.StampService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stamps")
@RequiredArgsConstructor
public class StampController {

    private final StampService stampService;

    @PostMapping
    public ResponseEntity<?> addStamp(
            @RequestParam("userId") String userId,
            @RequestParam("popupId") Long popupId
    ) {
        // [코드 해석] 인텔리제이 콘솔에 3033(또는 2033)이 찍히는지 확인하세요.
        System.out.println(">>> [스탬프 시도] 유저:" + userId + " | 팝업번호:" + popupId);

        try {
            stampService.addStamp(userId, popupId);
            return ResponseEntity.ok("🎉 스탬프 획득 성공! (팝업번호: " + popupId + ")");
        } catch (Exception e) {
            // [에러 해석] DB에 없는 번호면 여기서 "존재하지 않는 팝업" 메시지가 나옵니다.
            return ResponseEntity.badRequest().body("처리 실패: " + e.getMessage());
        }
    }

    @GetMapping("/my")
    public ResponseEntity<List<Stamp>> getMyStamps(@RequestParam String userId) {
        return ResponseEntity.ok(stampService.getMyStamps(userId));
    }
}