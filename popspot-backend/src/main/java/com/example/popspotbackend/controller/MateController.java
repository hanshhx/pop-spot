package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MateDto;
import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.service.MateService;
import com.example.popspotbackend.service.MateService.AccessDeniedToPostException;
import com.example.popspotbackend.service.MateService.BoostQuotaExceededException;
import com.example.popspotbackend.service.MateService.BoostStatus;
import com.example.popspotbackend.service.MateService.JoinResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 동행 모집 게시판 API.
 *
 * <p>실제 비즈니스 로직 (확성기 소비 · 정원 검사 · 자동 마감) 은 {@link MateService} 가 처리하며, 컨트롤러는 URL 매핑 + 결과 코드를 HTTP
 * 응답으로 변환하는 역할만 한다.
 */
@RestController
@RequestMapping("/api/mates")
@RequiredArgsConstructor
public class MateController {

    private static final String RESPONSE_FULL = "FULL";
    private static final String RESPONSE_JOIN_SUCCESS = "JOIN_SUCCESS";
    private static final String RESPONSE_DELETE_SUCCESS = "DELETE_SUCCESS";

    private final MateService mateService;

    @GetMapping
    public List<MatePost> getAllPosts() {
        return mateService.findAllPostsOrdered();
    }

    @GetMapping("/{postId}/chat")
    public ResponseEntity<List<MateChatMessage>> getChatMessages(@PathVariable Long postId) {
        return ResponseEntity.ok(mateService.findChatMessages(postId));
    }

    @PostMapping
    public ResponseEntity<MatePost> createPost(@RequestBody MateDto dto) {
        return ResponseEntity.ok(mateService.createPost(dto));
    }

    /** 글쓰기 모달에서 "이번 달 N회 남음" 표시용. 등급 + 한도 + 사용량 + 잔여 횟수. */
    @GetMapping("/boost-status")
    public ResponseEntity<BoostStatus> getBoostStatus(@RequestParam String userId) {
        return ResponseEntity.ok(mateService.getBoostStatus(userId));
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<String> joinMate(@PathVariable Long id, @RequestParam String userId) {
        JoinResult result = mateService.joinMate(id, userId);
        return switch (result) {
            case ALREADY_JOINED -> ResponseEntity.ok("이미 참여 중인 방입니다. 재입장합니다.");
            case FULL -> ResponseEntity.status(400).body(RESPONSE_FULL);
            case JOIN_SUCCESS -> ResponseEntity.ok(RESPONSE_JOIN_SUCCESS);
        };
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deletePost(@PathVariable Long id, @RequestParam String userId) {
        mateService.deletePost(id, userId);
        return ResponseEntity.ok(RESPONSE_DELETE_SUCCESS);
    }

    /**
     * v2.18.1 — 게시글 신고. 임계값 도달 시 자동 isHidden. 본인 글 신고는 거부.
     *
     * <p>응답으로 누적 신고 수를 돌려줘 프론트가 사용자에게 "n번째 신고가 접수됐습니다" 안내 가능.
     */
    @PostMapping("/{id}/report")
    public ResponseEntity<java.util.Map<String, Object>> reportPost(
            @PathVariable Long id, @RequestParam String userId) {
        int reportCount = mateService.reportPost(id, userId);
        return ResponseEntity.ok(java.util.Map.of("status", "REPORTED", "reportCount", reportCount));
    }

    /* ============================== 도메인 예외 → HTTP 매핑 ============================== */

    @ExceptionHandler(BoostQuotaExceededException.class)
    public ResponseEntity<String> handleBoostQuotaExceeded(BoostQuotaExceededException e) {
        return ResponseEntity.status(400).body(e.getMessage());
    }

    @ExceptionHandler(AccessDeniedToPostException.class)
    public ResponseEntity<String> handleAccessDeniedToPost(AccessDeniedToPostException e) {
        return ResponseEntity.status(403).body(e.getMessage());
    }
}
