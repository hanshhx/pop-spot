package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MateDto;
import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.service.MateService;
import com.example.popspotbackend.service.MateService.AccessDeniedToPostException;
import com.example.popspotbackend.service.MateService.InsufficientMegaphoneException;
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

    /* ============================== 도메인 예외 → HTTP 매핑 ============================== */

    @ExceptionHandler(InsufficientMegaphoneException.class)
    public ResponseEntity<String> handleInsufficientMegaphone(InsufficientMegaphoneException e) {
        return ResponseEntity.status(400).body(e.getMessage());
    }

    @ExceptionHandler(AccessDeniedToPostException.class)
    public ResponseEntity<String> handleAccessDeniedToPost(AccessDeniedToPostException e) {
        return ResponseEntity.status(403).body(e.getMessage());
    }
}
