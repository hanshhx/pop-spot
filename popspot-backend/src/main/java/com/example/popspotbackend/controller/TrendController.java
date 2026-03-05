package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.PexelsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/trends")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class TrendController {

    private final PexelsService pexelsService;

    // 호출 주소: GET http://localhost:8080/api/trends/ootd
    @GetMapping("/ootd")
    public ResponseEntity<Map<String, Object>> getOotd() {
        Map<String, String> videoData = pexelsService.getFashionVideo();

        Map<String, Object> response = new HashMap<>();
        response.put("type", "OOTD");

        if (videoData != null) {
            response.put("data", videoData);
            // 키워드에 따른 한줄 코멘트 매핑 (간단 로직)
            String keyword = videoData.get("keyword");
            String comment = switch (keyword) {
                case "street fashion" -> "힙한 성수동 골목, 이렇게 입으면 인생샷 확정! 📸";
                case "urban style" -> "모던한 팝업스토어엔 시크한 어반 룩이 딱이에요. 🕶️";
                default -> "오늘 성수동 주인공은 바로 당신! 이런 스타일 어때요? ✨";
            };
            response.put("comment", comment);
        } else {
            response.put("error", "영상을 불러오지 못했습니다.");
        }

        return ResponseEntity.ok(response);
    }
}