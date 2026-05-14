package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.CongestionService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 서울 실시간 인구 혼잡도 API. 지역 키를 받아 서비스로 위임한다. */
@RestController
@RequestMapping("/api/congestion")
@RequiredArgsConstructor
public class CongestionController {

    private static final String DEFAULT_AREA = "SEONGSU";

    private final CongestionService congestionService;

    @GetMapping
    public Map<String, Object> getCongestion(
            @RequestParam(name = "area", defaultValue = DEFAULT_AREA) String area) {
        return congestionService.getCongestionData(area);
    }
}
