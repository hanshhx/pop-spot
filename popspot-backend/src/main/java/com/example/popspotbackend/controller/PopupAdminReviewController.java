package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.crawler.PopupCrawlOrchestrator;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 자동수집된 팝업 검수 큐 (신뢰도 임계값 미만은 {@code reviewStatus = PENDING_REVIEW}).
 *
 * <p>기존 {@code AdminController} 는 사용자 제보({@code status = PENDING})를 검수하고, 본 컨트롤러는 자동수집 결과
 * (Naver/Kakao + LLM)를 검수한다. URL 충돌 방지를 위해 {@code /api/admin/popups/crawl} 하위로 분리되며 모든 엔드포인트는
 * ROLE_ADMIN 전용.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/popups/crawl")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PopupAdminReviewController {

    private static final int DEFAULT_PAGE_SIZE = 50;

    private static final String REVIEW_APPROVED = "APPROVED";
    private static final String REVIEW_REJECTED = "REJECTED";
    private static final String RESPONSE_STATUS_DELETED = "DELETED";

    private final PopupStoreRepository popupStoreRepository;
    private final PopupCrawlOrchestrator orchestrator;

    /** 자동수집 검수 대기 큐 (신뢰도 < 임계값). */
    @GetMapping("/pending")
    public ResponseEntity<List<PopupStore>> pending(
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
        return ResponseEntity.ok(popupStoreRepository.findPendingReview(PageRequest.of(0, size)));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(@PathVariable Long id) {
        PopupStore popup = findOrThrow(id);
        popup.setReviewStatus(REVIEW_APPROVED);
        popupStoreRepository.save(popup);
        log.info("[CrawlReview] APPROVED id={} name={}", id, popup.getName());
        return ResponseEntity.ok(Map.of("status", REVIEW_APPROVED, "id", id));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<Map<String, Object>> reject(@PathVariable Long id) {
        PopupStore popup = findOrThrow(id);
        popup.setReviewStatus(REVIEW_REJECTED);
        popupStoreRepository.save(popup);
        log.info("[CrawlReview] REJECTED id={} name={}", id, popup.getName());
        return ResponseEntity.ok(Map.of("status", REVIEW_REJECTED, "id", id));
    }

    /**
     * Takedown 영구 삭제. 약관상 24시간 내 노출 차단은 {@code reviewStatus = TAKEDOWN} 으로 우선 처리하고, 본 호출은 검토 후 영구
     * 삭제 단계에서만 호출한다 (악성 takedown 방어).
     */
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Map<String, Object>> permanentDelete(@PathVariable Long id) {
        PopupStore popup = findOrThrow(id);
        popupStoreRepository.delete(popup);
        log.warn("[CrawlReview] PERMANENT_DELETED id={} name={}", id, popup.getName());
        return ResponseEntity.ok(Map.of("status", RESPONSE_STATUS_DELETED, "id", id));
    }

    /** 운영자 디버깅용 수동 크롤 1회 트리거. */
    @PostMapping("/run")
    public ResponseEntity<Map<String, Object>> runCrawlNow() {
        log.info("[CrawlReview] 수동 크롤 트리거됨");
        Map<String, Integer> stats = orchestrator.runOnce();
        Map<String, Object> resp = new HashMap<>();
        resp.put("triggeredAt", LocalDateTime.now().toString());
        resp.put("stats", stats);
        return ResponseEntity.ok(resp);
    }

    /** 좌표 누락된 자동수집 row 일괄 geocoding backfill. */
    @PostMapping("/geocode-missing")
    public ResponseEntity<Map<String, Object>> geocodeMissing() {
        log.info("[CrawlReview] geocoding backfill 시작");
        return ResponseEntity.ok(Map.of("geocoded", orchestrator.geocodeMissing()));
    }

    private PopupStore findOrThrow(Long id) {
        return popupStoreRepository
                .findById(id)
                .orElseThrow(() -> new RuntimeException("팝업 id=" + id + " 없음"));
    }
}
