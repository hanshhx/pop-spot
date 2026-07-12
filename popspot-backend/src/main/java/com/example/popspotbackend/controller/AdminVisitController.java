package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.VisitStatsDto;
import com.example.popspotbackend.service.VisitService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 어드민 방문 통계 API. 익명 집계값만 반환. 클래스 단 ADMIN 가드. */
@RestController
@RequestMapping("/api/admin/visits")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminVisitController {

    private final VisitService visitService;

    @GetMapping("/stats")
    public ResponseEntity<VisitStatsDto> getStats() {
        return ResponseEntity.ok(visitService.getStats());
    }

    /** 오늘 방문 경로별 집계(경로·총·회원·게스트) — 유입이 어디서/누구인지 진단용. */
    @GetMapping("/today-paths")
    public ResponseEntity<List<Map<String, Object>>> getTodayPaths() {
        return ResponseEntity.ok(visitService.getTodayPaths());
    }

    /** 방문자 목록 — visitorId 단위(방문수·경로·최근시각·게스트/회원). days 기본 7, 최대 30. */
    @GetMapping("/visitors")
    public ResponseEntity<List<Map<String, Object>>> getRecentVisitors(
            @RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(visitService.getRecentVisitors(days));
    }
}
