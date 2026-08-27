package com.example.popspotbackend.controller;

import com.example.popspotbackend.config.AdminAuditInterceptor;
import com.example.popspotbackend.dto.AdminMatePostDto;
import com.example.popspotbackend.dto.AdminUserDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.AdminService;
import com.example.popspotbackend.service.ChatService;
import com.example.popspotbackend.service.PopupDedupService;
import com.example.popspotbackend.service.PopupPhotoService;
import com.example.popspotbackend.service.PopupStoreService;
import com.example.popspotbackend.service.backup.DatabaseBackupScheduler;
import com.example.popspotbackend.service.crawler.PopupTranslationBackfillService;
import com.example.popspotbackend.service.crawler.PopupTranslationBulkJobService;
import jakarta.servlet.http.HttpServletRequest;
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
    private final PopupStoreService popupStoreService;
    private final PopupPhotoService popupPhotoService;
    private final PopupDedupService popupDedupService;
    private final ChatService chatService;
    private final DatabaseBackupScheduler databaseBackupScheduler;
    private final PopupTranslationBackfillService popupTranslationBackfillService;
    private final PopupTranslationBulkJobService popupTranslationBulkJobService;

    /* ============================== 팝업 승인 큐 ============================== */

    @GetMapping("/popups/pending")
    public ResponseEntity<List<PopupStore>> getPendingPopups() {
        return ResponseEntity.ok(adminService.findPendingPopups());
    }

    @PostMapping("/popups/{id}/approve")
    public ResponseEntity<String> approvePopup(@PathVariable Long id) {
        popupStoreService.approveReview(id);
        return ResponseEntity.ok("승인 완료");
    }

    @DeleteMapping("/popups/{id}/reject")
    public ResponseEntity<String> rejectPopup(@PathVariable Long id) {
        popupStoreService.rejectReview(id);
        return ResponseEntity.ok("반려 완료");
    }

    /* ============================== 대시보드 / 전체 팝업 ============================== */

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getAdminStats());
    }

    @GetMapping("/backup/status")
    public ResponseEntity<Map<String, Object>> getBackupStatus() {
        return ResponseEntity.ok(databaseBackupScheduler.status());
    }

    @GetMapping("/popups/all")
    public ResponseEntity<List<PopupStore>> getAllPopupsForAdmin() {
        return ResponseEntity.ok(adminService.findAllPopups());
    }

    /**
     * 이미지 없는 공개 팝업에 Pexels 커버를 수동으로 배정(백필). {@code limit} 으로 배치 크기를 제한한다.
     *
     * <p><b>0 건일 때 왜 0 인지까지 돌려준다.</b> 예전에는 배정 개수만 실어 보내서, 키가 없어 아무 일도 안 한 경우와 정말 채울 것이 없는 경우가 화면에서
     * 똑같아 보였다 — 둘 다 200 에 {@code assigned:0} 이었다. 사진 없는 팝업이 수백 건인데 "0개 배정 완료" 가 뜨니 기능이 죽은 줄 알 수밖에
     * 없었다.
     */
    @PostMapping("/popups/backfill-photos")
    public ResponseEntity<Map<String, Object>> backfillPhotos(
            @RequestParam(defaultValue = "150") int limit, HttpServletRequest request) {
        PopupPhotoService.BackfillReport r = popupPhotoService.backfillMissingPhotos(limit);
        AdminAuditInterceptor.addDetail(
                request,
                "배정="
                        + r.assigned()
                        + " 대상="
                        + r.photoless()
                        + " 키="
                        + (r.configured() ? "O" : "X"));
        return ResponseEntity.ok(
                Map.of(
                        "assigned", r.assigned(),
                        "configured", r.configured(),
                        "photoless", r.photoless(),
                        "scanned", r.scanned(),
                        "searchEmpty", r.searchEmpty()));
    }

    /**
     * 외국어 화면용 이름·장소 번역 백필.
     *
     * <p>매일 새벽에도 자동으로 돌지만, 한 배치를 바로 확인하고 싶을 때 손으로 부른다. 확신이 없어 비워 둔 건은 {@code skipped} 로 잡히고 다시 시도하지
     * 않는다 — 원문이 나은 이름도 실제로 있다("한복상점" 을 "Hanbok Shop" 으로 풀면 서울에 수백 개인 업태명이 된다).
     */
    @PostMapping("/popups/backfill-translations")
    public ResponseEntity<Map<String, Object>> backfillTranslations() {
        return ResponseEntity.ok(Map.copyOf(popupTranslationBackfillService.runOnce()));
    }

    /**
     * 누락된 과거 행을 재대기시킨 뒤 여러 배치를 백그라운드로 처리한다.
     *
     * <p>진행 상황은 {@code /status} 로 본다. <b>관리자 화면의 시험·전체 버튼이 모두 이 길을 쓴다</b> — 차이는 {@code maxBatches}
     * 뿐이다. 위의 동기 백필은 배치 하나짜리 수동 점검용으로 남겨 둔다.
     *
     * @param maxBatches 0이면 대상이 마를 때까지, 1 이상이면 그 횟수만 돌고 멈춘다.
     */
    @PostMapping("/popups/backfill-translations/bulk")
    public ResponseEntity<Map<String, Object>> startTranslationBulkBackfill(
            @RequestParam(defaultValue = "true") boolean retryMissing,
            @RequestParam(defaultValue = "0") int maxBatches) {
        return ResponseEntity.accepted()
                .body(popupTranslationBulkJobService.start(retryMissing, Math.max(0, maxBatches)));
    }

    /** 대량 번역 작업 진행 상태. 서버 재시작 시 작업은 중단되며 다시 시작할 수 있다. */
    @GetMapping("/popups/backfill-translations/status")
    public ResponseEntity<Map<String, Object>> translationBulkBackfillStatus() {
        return ResponseEntity.ok(popupTranslationBulkJobService.status());
    }

    /** 이름이 완전히 동일한 중복 팝업 그룹 미리보기(적용 전 확인용). */
    @GetMapping("/popups/duplicates")
    public ResponseEntity<List<Map<String, Object>>> previewDuplicates() {
        return ResponseEntity.ok(popupDedupService.previewDuplicates());
    }

    /**
     * 중복 정리 실행 — 그룹별 대표 1건만 남기고 나머지 숨김 + Algolia 색인 제거.
     *
     * <p>처리 건수를 감사 기록에 덧붙인다. 되돌릴 수 없는 일괄 처리에서는 "무엇을 했는가" 만으로 부족하고 <b>몇 건이었는지</b>가 피해 규모를 말해 준다.
     */
    @PostMapping("/popups/dedupe")
    public ResponseEntity<Map<String, Object>> dedupe(HttpServletRequest request) {
        Map<String, Object> result = popupDedupService.dedupe();
        AdminAuditInterceptor.addDetail(request, "결과=" + result);
        return ResponseEntity.ok(result);
    }

    /* ============================== 라이브 댓글(채팅) 관리 ============================== */

    /** 최근 라이브 댓글(채팅) 100건 — 부적절한 댓글 삭제 대상 조회. */
    @GetMapping("/chat/recent")
    public ResponseEntity<List<Map<String, Object>>> getRecentChats() {
        return ResponseEntity.ok(chatService.findRecentMessages());
    }

    /** 라이브 댓글 삭제. */
    @DeleteMapping("/chat/{id}")
    public ResponseEntity<String> deleteChat(@PathVariable Long id) {
        chatService.deleteMessage(id);
        return ResponseEntity.ok("삭제 완료");
    }

    /** 라이브 댓글 일괄 삭제 — 선택한 id 목록을 한 번에. 삭제 건수를 감사 기록에 덧붙인다. */
    @PostMapping("/chat/delete-batch")
    public ResponseEntity<Map<String, Object>> deleteChatsBatch(
            @RequestBody List<Long> ids, HttpServletRequest request) {
        int deleted = chatService.deleteMessages(ids);
        AdminAuditInterceptor.addDetail(request, "삭제=" + deleted);
        return ResponseEntity.ok(Map.of("deleted", deleted));
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

    /** 동행 게시글 목록 — 신고자·참가자 명단과 작성자 개인정보를 뺀 DTO 로 내보낸다. */
    @GetMapping("/mate-posts")
    public ResponseEntity<List<AdminMatePostDto>> getAllMatePosts() {
        return ResponseEntity.ok(
                adminService.findAllMatePostsOrdered().stream()
                        .map(AdminMatePostDto::from)
                        .toList());
    }

    @DeleteMapping("/mate-posts/{id}")
    public ResponseEntity<String> forceDeleteMatePost(@PathVariable Long id) {
        adminService.forceDeleteMatePost(id);
        return ResponseEntity.ok("게시글이 강제 삭제되었습니다.");
    }

    /**
     * 굿즈 등록 화면에서 팝업을 고르기 위한 전체 목록 (검수 상태 무관).
     *
     * <p>{@code GoodsController} 의 {@code GET /api/goods/stores} 에서 옮겨왔다. 그 경로는 {@code
     * SecurityConfig} 의 {@code /api/**} permitAll 에 걸려 무인증이었고 응답이 {@code findAll()} 이라 필터가 하나도 없어서,
     * 숨긴 PENDING · REJECTED · TAKEDOWN 팝업의 이름 · 위치 · 설명이 누구에게나 나갔다.
     */
    @GetMapping("/goods/stores")
    public ResponseEntity<List<PopupStore>> getGoodsPopupStores() {
        return ResponseEntity.ok(popupStoreService.findAll());
    }
}
