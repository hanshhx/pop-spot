package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.AiSearchService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 자연어(AI) 팝업 검색 — 검색어를 LLM 이 해석해 매칭 팝업 id 목록을 반환한다.
 *
 * <p>프론트(서치존의 'AI로 찾기')는 반환된 id 로 지도 핀을 필터해 "검색어에 맞는 핀만" 남긴다. 검색어가 비면 빈 배열.
 */
@RestController
@RequiredArgsConstructor
public class AiSearchController {

    private final AiSearchService aiSearchService;

    @GetMapping("/api/search/ai")
    public Map<String, List<String>> search(
            @RequestParam(value = "q", required = false, defaultValue = "") String q) {
        return Map.of("ids", aiSearchService.searchPopupIds(q));
    }
}
