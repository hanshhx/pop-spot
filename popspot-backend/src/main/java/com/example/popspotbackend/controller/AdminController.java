package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
// 🔥 [관리자 페이지 안 뜨는 원인 제거]
// 여기에 있던 @CrossOrigin(origins = "http://localhost:3000")를 지웠습니다!
// 이제 실제 도메인(popspot.co.kr)에서도 데이터가 쫙! 뜹니다.
public class AdminController {

    private final PopupStoreRepository popupStoreRepository;
    private final AdminService adminService;

    // 🔥 [신규 추가] 컨트롤러에서도 메이트 게시글 리스트를 반환하기 위해 주입
    private final MatePostRepository matePostRepository;

    // ================= [기존 로직 유지] =================

    // 1. 대기 중(PENDING)인 팝업 목록 불러오기
    @GetMapping("/popups/pending")
    public ResponseEntity<List<PopupStore>> getPendingPopups() {
        return ResponseEntity.ok(popupStoreRepository.findByStatus("PENDING"));
    }

    // 2. 관리자 승인 버튼 클릭 시
    @PostMapping("/popups/{id}/approve")
    public ResponseEntity<String> approvePopup(@PathVariable Long id) {
        adminService.approvePopup(id);
        return ResponseEntity.ok("승인 및 보상 지급 완료!");
    }

    // 3. 관리자 거절 버튼 클릭 시
    @DeleteMapping("/popups/{id}/reject")
    public ResponseEntity<String> rejectPopup(@PathVariable Long id) {
        adminService.rejectPopup(id);
        return ResponseEntity.ok("거절(삭제) 완료!");
    }

    // ================= [🔥 신규 관리자 API 추가] =================

    // 1. 📊 대시보드 통계 조회
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getAdminStats());
    }

    // 2. 🛑 전체 팝업스토어 조회 및 상태 강제 변경
    @GetMapping("/popups/all")
    public ResponseEntity<List<PopupStore>> getAllPopupsForAdmin() {
        // 관리자는 필터링 없이(PENDING, 영업중, 종료 등) 모든 팝업을 봅니다.
        return ResponseEntity.ok(popupStoreRepository.findAll());
    }

    @PatchMapping("/popups/{id}/status")
    public ResponseEntity<String> changePopupStatus(@PathVariable Long id, @RequestParam String status) {
        adminService.changePopupStatus(id, status);
        return ResponseEntity.ok("상태가 [" + status + "]로 변경되었습니다.");
    }

    // 3. 🎁 유저에게 아이템 수동 지급
    @PostMapping("/reward")
    public ResponseEntity<String> giveReward(@RequestBody Map<String, String> request) {
        try {
            String nickname = request.get("nickname");
            String itemType = request.get("itemType"); // "MEGAPHONE" or "POPPASS"
            int amount = Integer.parseInt(request.get("amount"));

            adminService.giveReward(nickname, itemType, amount);
            return ResponseEntity.ok(nickname + "님에게 보상이 지급되었습니다.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("지급 실패: " + e.getMessage());
        }
    }

    // 4. 🧹 전체 메이트 게시글 조회 및 강제 삭제
    @GetMapping("/mate-posts")
    public ResponseEntity<List<MatePost>> getAllMatePosts() {
        // 최신순 정렬 메서드를 호출하여 관리자 화면에 뿌려줍니다.
        return ResponseEntity.ok(matePostRepository.findAllByOrderByIsMegaphoneDescCreatedAtDesc());
    }

    @DeleteMapping("/mate-posts/{id}")
    public ResponseEntity<String> forceDeleteMatePost(@PathVariable Long id) {
        adminService.forceDeleteMatePost(id);
        return ResponseEntity.ok("게시글이 강제 삭제되었습니다.");
    }
}