package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.CalendarPopupDto;
import com.example.popspotbackend.dto.PopupReportRequestDto;
import com.example.popspotbackend.dto.PopupTakedownRequestDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.PopupStoreService;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 팝업스토어 공개 엔드포인트.
 *
 * <p>CORS 는 {@code SecurityConfig} 의 전역 설정에 위임하므로 컨트롤러 단 {@code @CrossOrigin} 은 두지 않는다. 팝업 takedown
 * 은 즉시 노출만 차단하고 실제 row 삭제는 admin 승인 후 별도 처리 (악성 신고 방어).
 */
@Slf4j
@RestController
@RequestMapping("/api/popups")
@RequiredArgsConstructor
public class PopupStoreController {

    private static final String REVIEW_STATUS_TAKEDOWN = "TAKEDOWN";
    private static final String STATUS_PENDING = "PENDING";
    private static final String IMAGE_NOTE_PREFIX = "\n\n[제보 이미지] ";

    private final PopupStoreService popupStoreService;
    private final YouTubeService youTubeService;

    @GetMapping
    public ResponseEntity<List<PopupStore>> getAllPopups(
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(popupStoreService.getAllPopups(category));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getPopupById(@PathVariable Long id) {
        PopupStore popup = popupStoreService.getPopupById(id);
        String videoId = youTubeService.searchVideoId(popup.getName());

        Map<String, Object> result = new HashMap<>();
        result.put("data", popup);
        result.put("imageUrl", popup.getImageUrl());
        result.put("videoId", videoId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/trending")
    public ResponseEntity<List<PopupStore>> getTrendingPopups() {
        return ResponseEntity.ok(popupStoreService.getTrendingPopups());
    }

    @GetMapping("/search")
    public ResponseEntity<List<PopupStore>> searchPopups(@RequestParam String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(popupStoreService.searchPopups(keyword));
    }

    /**
     * 캘린더 — 1~2개월치 팝업. 파라미터를 생략하면 오늘 ~ 60일 후.
     *
     * @param from YYYY-MM-DD 시작일 (선택)
     * @param to YYYY-MM-DD 종료일 (선택)
     */
    @GetMapping("/calendar")
    public ResponseEntity<List<CalendarPopupDto>> getCalendar(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return ResponseEntity.ok(popupStoreService.getCalendar(from, to));
    }

    /** 권리자 takedown 요청. 즉시 노출 차단하고 admin 후속 조사로 넘긴다. */
    @PostMapping("/{id}/takedown")
    public ResponseEntity<Map<String, Object>> requestTakedown(
            @PathVariable Long id, @Valid @RequestBody PopupTakedownRequestDto dto) {
        PopupStore popup = popupStoreService.findOrThrow(id);
        applyTakedown(popup, dto);
        popupStoreService.save(popup);

        log.warn(
                "[Takedown] 팝업 id={} name='{}' 요청자={} 사유='{}' → 노출 즉시 차단",
                id,
                popup.getName(),
                dto.getRequesterEmail(),
                dto.getReason());

        return ResponseEntity.ok(buildTakedownResponse(id));
    }

    /** 사용자 팝업 제보. DTO 화이트리스트로 Mass Assignment 방어. */
    @PostMapping("/report")
    public ResponseEntity<Map<String, Object>> reportPopup(
            @Valid @RequestBody PopupReportRequestDto dto) {
        PopupStore saved = popupStoreService.save(buildReportedPopup(dto));

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", saved.getId());
        resp.put("status", saved.getStatus());
        resp.put("message", "제보 완료. 관리자 승인 후 노출됩니다.");
        return ResponseEntity.ok(resp);
    }

    /* ============================== 내부 헬퍼 ============================== */

    private void applyTakedown(PopupStore popup, PopupTakedownRequestDto dto) {
        popup.setReviewStatus(REVIEW_STATUS_TAKEDOWN);
        popup.setTakedownRequestedAt(LocalDateTime.now());
        popup.setTakedownReason(dto.getReason());
        popup.setTakedownRequester(dto.getRequesterEmail());
    }

    private Map<String, Object> buildTakedownResponse(Long id) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "ACCEPTED");
        resp.put("message", "신고가 접수되었습니다. 24시간 내 검토 후 조치합니다.");
        resp.put("popupId", id);
        return resp;
    }

    /** 제보 단계에서는 imageUrl 필드가 없어 description 끝에 메모로 남긴다. 정식 등록은 관리자가 PopupImage 를 통해 추가한다. */
    private PopupStore buildReportedPopup(PopupReportRequestDto dto) {
        String description = appendImageNote(dto.getDescription(), dto.getImageUrl());
        PopupStore popup =
                PopupStore.builder()
                        .name(dto.getName())
                        .location(dto.getLocation())
                        .category(dto.getCategory())
                        .description(description)
                        .startDate(dto.getStartDate())
                        .endDate(dto.getEndDate())
                        .build();
        popup.setStatus(STATUS_PENDING);
        popup.setViewCount(0);
        return popup;
    }

    private String appendImageNote(String description, String imageUrl) {
        String base = description == null ? "" : description;
        if (imageUrl != null && !imageUrl.isBlank()) {
            return base + IMAGE_NOTE_PREFIX + imageUrl;
        }
        return base;
    }
}
