package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.SearchService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Algolia 검색 인덱스 동기화 트리거.
 *
 * <p>v2.13: 정확도 / 유효 가드를 인덱싱 시점에 적용하도록 정책을 강화했고, 옛 인덱스에 들어가 있는 부적격 row 를 한 번에 청소하려면 {@code POST
 * /api/admin/search/reindex} 를 호출한다. 그 외 옛 {@code GET /api/search/sync} 경로도 호환을 위해 유지하지만 동일 동작이며
 * ADMIN 가드가 적용된다.
 */
@RestController
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    /** 호환용 — 옛 운영 스크립트가 그대로 호출. */
    @GetMapping("/api/search/sync")
    @PreAuthorize("hasRole('ADMIN')")
    public String syncAll() {
        searchService.syncAllPopups();
        return "Algolia 데이터 동기화 완료";
    }

    /** v2.13 — 어드민 UI 에서 호출. 인덱싱 가능 row 만 다시 push 하고 부적격 row 는 삭제. */
    @PostMapping("/api/admin/search/reindex")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> reindex() {
        int indexed = searchService.syncAllPopups();
        return ResponseEntity.ok(Map.of("indexed", indexed));
    }
}
