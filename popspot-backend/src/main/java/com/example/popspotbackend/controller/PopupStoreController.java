package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.PopupReportRequestDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.PopupStoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/popups")
@RequiredArgsConstructor
// SecurityConfig 의 전역 CORS 설정과 충돌하지 않도록 컨트롤러 단 @CrossOrigin 제거.
public class PopupStoreController {

    private final PopupStoreService popupStoreService;
    private final YouTubeService youTubeService;
    private final PopupStoreRepository popupStoreRepository;

    @GetMapping
    public ResponseEntity<List<PopupStore>> getAllPopups(@RequestParam(required = false) String category) {
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
     * 팝업 제보 — Mass Assignment 방어를 위해 DTO 사용.
     * 사용자는 id / status / viewCount 등을 임의로 박아 보낼 수 없음.
     */
    @PostMapping("/report")
    public ResponseEntity<Map<String, Object>> reportPopup(@Valid @RequestBody PopupReportRequestDto dto) {
        // PopupStore.imageUrl 은 필드가 아니라 PopupImage 리스트에서 계산되는 getter.
        // 제보 단계에서는 이미지 URL 을 description 끝에 메모로 남기고, 정식 등록은 관리자가 PopupImage 추가.
        String desc = dto.getDescription() == null ? "" : dto.getDescription();
        if (dto.getImageUrl() != null && !dto.getImageUrl().isBlank()) {
            desc = desc + "\n\n[제보 이미지] " + dto.getImageUrl();
        }

        PopupStore popup = PopupStore.builder()
                .name(dto.getName())
                .location(dto.getLocation())
                .category(dto.getCategory())
                .description(desc)
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .build();
        popup.setStatus("PENDING");   // 항상 대기 상태로 시작
        popup.setViewCount(0);         // 조회수 0 으로 시작

        PopupStore saved = popupStoreRepository.save(popup);

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", saved.getId());
        resp.put("status", saved.getStatus());
        resp.put("message", "제보 완료. 관리자 승인 후 노출됩니다.");
        return ResponseEntity.ok(resp);
    }
}
