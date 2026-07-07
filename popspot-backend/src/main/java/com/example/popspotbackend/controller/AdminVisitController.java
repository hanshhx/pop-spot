package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.VisitStatsDto;
import com.example.popspotbackend.service.VisitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
