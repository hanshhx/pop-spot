package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.FunnelDto;
import com.example.popspotbackend.dto.SessionStatsDto;
import com.example.popspotbackend.dto.VisitReferrerDto;
import com.example.popspotbackend.dto.VisitStatsDto;
import com.example.popspotbackend.repository.VisitLogRepository;
import com.example.popspotbackend.service.VisitService;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

    /** 유입 집계는 읽기 전용 단일 쿼리라 VisitService 를 거치지 않고 바로 조회한다. */
    private final VisitLogRepository visitLogRepository;

    @GetMapping("/stats")
    public ResponseEntity<VisitStatsDto> getStats() {
        return ResponseEntity.ok(visitService.getStats());
    }

    /**
     * C-3 — 세션 기준 요약. 세션 수 · 신규/재방문 · 재방문율 · 세션당 행동 수.
     *
     * <p>수집은 이미 되고 있었고({@code visit_event.session_id}) 읽는 곳만 없었다. 새로 쌓는 것 없이
     * 집계만 한다.
     *
     * @param days 최근 며칠. 화면은 7·30·90 을 준다. 보관기간을 넘겨 물으면 응답의 {@code truncated}
     *     가 {@code true} 로 와서 "그만큼 재방문이 덜 잡혔다" 를 알린다
     */
    @GetMapping("/sessions")
    public ResponseEntity<SessionStatsDto> getSessionStats(
            @RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(visitService.getSessionStats(days));
    }

    /**
     * C-4 퍼널 — 방문 → 상세 열기 → 찜 → 예약·공식 링크 → 다시 방문.
     *
     * <p>각 칸은 <b>사람 수</b>다. 한 사람이 팝업 스무 개를 연 것과 스무 명이 하나씩 연 것이 같아
     * 보이면 안 되기 때문이다.
     *
     * <p>응답의 {@code note} 는 화면이 그대로 보여 줄 한 줄이다 — 찜·외부이동은 최근에야 수집을
     * 시작해서 그 전 기간은 0 으로 보인다는 사실을 담는다.
     */
    @GetMapping("/funnel")
    public ResponseEntity<FunnelDto> getFunnel(@RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(visitService.getFunnel(days));
    }

    /** 오늘 방문 경로별 집계(경로·총·회원·게스트) — 유입이 어디서/누구인지 진단용. */
    @GetMapping("/today-paths")
    public ResponseEntity<List<Map<String, Object>>> getTodayPaths() {
        return ResponseEntity.ok(visitService.getTodayPaths());
    }

    /** 방문자 목록 — visitorId 단위(방문수·경로·최근시각·게스트/회원). days 기본 7, 최대 30. */
    /**
     * 방문자 목록 — 기간·페이지 선택 가능.
     *
     * @param days 최근 며칠(기본 7, 최대 90). 화면은 7·30·90 을 버튼으로 제공한다
     */
    @GetMapping("/visitors")
    public ResponseEntity<Map<String, Object>> getRecentVisitors(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(visitService.getRecentVisitors(days, page, size));
    }

    /** 유입 캠페인 — 어떤 홍보가 몇 명을 데려왔나. */
    @GetMapping("/campaigns")
    public ResponseEntity<List<Map<String, Object>>> getCampaigns(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(visitService.campaigns(days));
    }

    /**
     * 많이 열린 팝업 — 목록에서 카드를 눌러 상세를 연 횟수.
     *
     * <p>페이지뷰(방문 통계)와 다르다. 페이지뷰는 "상세 화면이 몇 번 열렸나" 라 링크를 직접 받아 들어온 것도 포함되는데, 이 값은 <b>우리 목록에서 눌린</b>
     * 것만 센다. 어떤 팝업을 앞에 놓을지 판단하는 데 쓰인다.
     */
    @GetMapping("/popup-opens")
    public ResponseEntity<List<Map<String, Object>>> getTopOpenedPopups(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(visitService.topOpenedPopups(days, limit));
    }

    /**
     * 유입 경로 집계 — 어디서 들어왔는지(네이버·구글·직접 방문 등)를 방문수 내림차순으로. days 기본 7, 최대 30(다른 엔드포인트와 동일). 사이트 내
     * 이동(internal)은 유입이 아니라 빠진다.
     */
    @GetMapping("/referrers")
    public ResponseEntity<List<VisitReferrerDto>> getReferrers(
            @RequestParam(defaultValue = "7") int days) {
        int safeDays = days <= 0 ? 7 : Math.min(days, 30);
        LocalDateTime since = LocalDate.now().minusDays(safeDays - 1L).atStartOfDay();
        return ResponseEntity.ok(
                VisitReferrerDto.from(visitLogRepository.referrerHostsSince(since)));
    }
}
