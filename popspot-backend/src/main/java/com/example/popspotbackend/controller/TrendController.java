package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.PexelsService;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 트렌드 콘텐츠 (OOTD 영상 등) 추천 엔드포인트. */
@RestController
@RequestMapping("/api/trends")
@RequiredArgsConstructor
public class TrendController {

    private static final String KEYWORD_STREET_FASHION = "street fashion";
    private static final String KEYWORD_URBAN_STYLE = "urban style";

    private static final String COMMENT_STREET = "힙한 성수동 골목, 이렇게 입으면 인생샷 확정!";
    private static final String COMMENT_URBAN = "모던한 팝업스토어엔 시크한 어반 룩이 딱이에요.";
    private static final String COMMENT_DEFAULT = "오늘 성수동 주인공은 바로 당신! 이런 스타일 어때요?";

    private final PexelsService pexelsService;

    @GetMapping("/ootd")
    public ResponseEntity<Map<String, Object>> getOotd() {
        Map<String, String> videoData = pexelsService.getFashionVideo();

        Map<String, Object> response = new HashMap<>();
        response.put("type", "OOTD");
        if (videoData == null) {
            response.put("error", "영상을 불러오지 못했습니다.");
            return ResponseEntity.ok(response);
        }

        response.put("data", videoData);
        response.put("comment", commentFor(videoData.get("keyword")));
        return ResponseEntity.ok(response);
    }

    private String commentFor(String keyword) {
        return switch (keyword) {
            case KEYWORD_STREET_FASHION -> COMMENT_STREET;
            case KEYWORD_URBAN_STYLE -> COMMENT_URBAN;
            default -> COMMENT_DEFAULT;
        };
    }
}
