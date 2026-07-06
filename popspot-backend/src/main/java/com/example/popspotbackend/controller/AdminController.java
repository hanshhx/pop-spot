package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.AdminUserDto;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.PopupStore;
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
 * 바뀌어도 권한 체크가 누락되지 않도록 하는 안전장치다. 모든 도메인 로직은 {@link AdminService} 에 위임한다.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    /* ============================== 팝업 승인 큐 ============================== */

    @GetMapping("/popups/pending")
    public ResponseEntity<List<PopupStore>> getPendingPopups() {
        return ResponseEntity.ok(adminService.findPendingPopups());
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

    @GetMapping("/popups/all")
    public ResponseEntity<List<PopupStore>> getAllPopupsForAdmin() {
        return ResponseEntity.ok(adminService.findAllPopups());
    }

    @PatchMapping("/popups/{id}/status")
    public ResponseEntity<String> changePopupStatus(
            @PathVariable Long id, @RequestParam String status) {
        adminService.changePopupStatus(id, status);
        return ResponseEntity.ok("상태가 [" + status + "]로 변경되었습니다.");
    }

    /* ============================== 회원 목록 ============================== */

    /** v2.27 — 가입자 목록(최신순). 비밀번호 제외 DTO 반환. */
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserDto>> getAllUsers() {
        return ResponseEntity.ok(adminService.findAllUsers());
    }

    /* ============================== 보상 / 메이트 운영 ============================== */

    /**
     * 유저 nickname 으로 MEGAPHONE / POPPASS 아이템 수동 지급.
     *
     * <p>입력 검증은 {@link IllegalArgumentException} 으로 격상해 GlobalExceptionHandler 위임.
     */
    @PostMapping("/reward")
    public ResponseEntity<String> giveReward(@RequestBody Map<String, String> request) {
        String nickname = requireField(request, "nickname");
        String itemType = requireField(request, "itemType");
        int amount = parseAmount(request.get("amount"));
        adminService.giveReward(nickname, itemType, amount);
        return ResponseEntity.ok(nickname + "님에게 보상이 지급되었습니다.");
    }

    private String requireField(Map<String, String> request, String key) {
        String value = request.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(key + " 값이 비어 있습니다.");
        }
        return value;
    }

    private int parseAmount(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("amount 값이 비어 있습니다.");
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("amount 는 정수여야 합니다: " + raw);
        }
    }

    @GetMapping("/mate-posts")
    public ResponseEntity<List<MatePost>> getAllMatePosts() {
        return ResponseEntity.ok(adminService.findAllMatePostsOrdered());
    }

    @DeleteMapping("/mate-posts/{id}")
    public ResponseEntity<String> forceDeleteMatePost(@PathVariable Long id) {
        adminService.forceDeleteMatePost(id);
        return ResponseEntity.ok("게시글이 강제 삭제되었습니다.");
    }
}
