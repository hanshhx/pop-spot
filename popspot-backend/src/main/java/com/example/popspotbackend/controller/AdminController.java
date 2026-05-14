package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.AdminService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 운영 콘솔 API.
 *
 * <p>클래스 단 {@code @PreAuthorize("hasRole('ADMIN')")} 로 SecurityConfig URL 매칭과 이중 방어를 건다. 라우트 패턴이
 * 바뀌어도 권한 체크가 누락되지 않도록 하는 안전장치다.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private static final String STATUS_PENDING = "PENDING";

    private final PopupStoreRepository popupStoreRepository;
    private final MatePostRepository matePostRepository;
    private final AdminService adminService;

    /* ============================== 팝업 승인 큐 ============================== */

    @GetMapping("/popups/pending")
    public ResponseEntity<List<PopupStore>> getPendingPopups() {
        return ResponseEntity.ok(popupStoreRepository.findByStatus(STATUS_PENDING));
    }

    @PostMapping("/popups/{id}/approve")
    public ResponseEntity<String> approvePopup(@PathVariable Long id) {
        adminService.approvePopup(id);
        return ResponseEntity.ok("승인 및 보상 지급 완료!");
    }

    @DeleteMapping("/popups/{id}/reject")
    public ResponseEntity<String> rejectPopup(@PathVariable Long id) {
        adminService.rejectPopup(id);
        return ResponseEntity.ok("거절(삭제) 완료!");
    }

    /* ============================== 대시보드 / 전체 팝업 ============================== */

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getAdminStats());
    }

    /** 관리자는 PENDING/영업중/종료 구분 없이 모든 팝업을 본다. */
    @GetMapping("/popups/all")
    public ResponseEntity<List<PopupStore>> getAllPopupsForAdmin() {
        return ResponseEntity.ok(popupStoreRepository.findAll());
    }

    @PatchMapping("/popups/{id}/status")
    public ResponseEntity<String> changePopupStatus(
            @PathVariable Long id, @RequestParam String status) {
        adminService.changePopupStatus(id, status);
        return ResponseEntity.ok("상태가 [" + status + "]로 변경되었습니다.");
    }

    /* ============================== 보상 / 메이트 운영 ============================== */

    /** 유저 nickname 으로 MEGAPHONE / POPPASS 아이템 수동 지급. */
    @PostMapping("/reward")
    public ResponseEntity<String> giveReward(@RequestBody Map<String, String> request) {
        try {
            String nickname = request.get("nickname");
            String itemType = request.get("itemType");
            int amount = Integer.parseInt(request.get("amount"));
            adminService.giveReward(nickname, itemType, amount);
            return ResponseEntity.ok(nickname + "님에게 보상이 지급되었습니다.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("지급 실패: " + e.getMessage());
        }
    }

    @GetMapping("/mate-posts")
    public ResponseEntity<List<MatePost>> getAllMatePosts() {
        return ResponseEntity.ok(matePostRepository.findAllByOrderByIsMegaphoneDescCreatedAtDesc());
    }

    @DeleteMapping("/mate-posts/{id}")
    public ResponseEntity<String> forceDeleteMatePost(@PathVariable Long id) {
        adminService.forceDeleteMatePost(id);
        return ResponseEntity.ok("게시글이 강제 삭제되었습니다.");
    }
}
