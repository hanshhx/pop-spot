package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    // 이 주소를 브라우저에 치면 DB 데이터를 Algolia로 업로드합니다.
    // http://localhost:8080/api/search/sync
    @GetMapping("/sync")
    public String syncAll() {
        searchService.syncAllPopups();
        return "✅ Algolia 데이터 동기화 완료!";
    }
}