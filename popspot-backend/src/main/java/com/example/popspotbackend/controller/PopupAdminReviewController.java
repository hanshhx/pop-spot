package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.crawler.PopupCrawlOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * [V4] 자동수집된 팝업 중 신뢰도 < 임계값 인 것들 (PENDING_REVIEW) 을 admin 이 검수.
 *
 * 모든 엔드포인트 ROLE_ADMIN 만 호출 가능.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/popups")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PopupAdminReviewController {

    private final PopupStoreRepository popupStoreRepository;
    private final PopupCrawlOrchestrator orchestrator;

    /** 검수 대기 큐 */
    @GetMapping("/pending")
    public ResponseEntity<List<PopupStore>> pending(
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(popupStoreRepository.findPendingReview(PageRequest.of(0, size)));
    }

    /** 승인 → 즉시 노출 */
    @PostMapping("/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(@PathVariable Long id) {
        PopupStore p = popupStoreRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("팝업 id=" + id + " 없음"));
        p.setReviewStatus("APPROVED");
        popupStoreRepository.save(p);
        log.info("[AdminReview] APPROVED id={} name={}", id, p.getName());
        return ResponseEntity.ok(Map.of("status","APPROVED","id",id));
    }

    /** 거부 → 영구 비공개 */
    @PostMapping("/{id}/reject")
    public ResponseEntity<Map<String, Object>> reject(@PathVariable Long id) {
        PopupStore p = popupStoreRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("팝업 id=" + id + " 없음"));
        p.setReviewStatus("REJECTED");
        popupStoreRepository.save(p);
        log.info("[AdminReview] REJECTED id={} name={}", id, p.getName());
        return ResponseEntity.ok(Map.of("status","REJECTED","id",id));
    }

    /**
     * Takedown 처리 후 영구 삭제 (악성 takedown 방어 위해 admin 만 가능).
     * - 24시간 내 조치 약관 만족 위해 reviewStatus=TAKEDOWN 으로 즉시 hide 가 우선,
     *   영구 삭제는 검토 후 별도 호출.
     */
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Map<String, Object>> permanentDelete(@PathVariable Long id) {
        PopupStore p = popupStoreRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("팝업 id=" + id + " 없음"));
        popupStoreRepository.delete(p);
        log.warn("[AdminReview] PERMANENT_DELETED id={} name={}", id, p.getName());
        return ResponseEntity.ok(Map.of("status","DELETED","id",id));
    }

    /** 수동 크롤 1회 트리거 (운영자 디버깅용) */
    @PostMapping("/crawl/run")
    public ResponseEntity<Map<String, Object>> runCrawlNow() {
        log.info("[AdminReview] 수동 크롤 트리거됨");
        Map<String, Integer> stats = orchestrator.runOnce();
        Map<String, Object> resp = new HashMap<>();
        resp.put("triggeredAt", LocalDateTime.now().toString());
        resp.put("stats", stats);
        return ResponseEntity.ok(resp);
    }
}
