package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.CongestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/congestion")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class CongestionController {

    private final CongestionService congestionService;

    // [🔥 수정됨]
    // 1. 반환 타입을 DTO -> Map<String, Object>로 변경 (Service가 Map을 반환하므로)
    // 2. @RequestParam 추가: ?area=YEOUIDO 처럼 요청을 받기 위함
    @GetMapping
    public Map<String, Object> getCongestion(@RequestParam(name = "area", defaultValue = "SEONGSU") String area) {
        // 프론트엔드에서 보낸 지역 키(area)를 서비스에 전달합니다.
        // 값이 안 넘어오면 기본값 "SEONGSU"로 동작합니다.
        return congestionService.getCongestionData(area);
    }
}