package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Algolia 검색 인덱스 동기화 트리거 ({@code GET /api/search/sync}). 운영 중에는 admin 만 호출하도록 SecurityConfig 에서
 * 보호한다.
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping("/sync")
    public String syncAll() {
        searchService.syncAllPopups();
        return "Algolia 데이터 동기화 완료";
    }
}
