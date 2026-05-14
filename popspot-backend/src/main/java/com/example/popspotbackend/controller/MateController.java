package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MateDto;
import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.MateChatMessageRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
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
 * <p>확성기 아이템 사용 시 작성자의 {@code megaphoneCount} 가 1 차감되며 게시글이 상단 고정된다. 참가 요청은 멱등(이미 참여한 사용자는 재입장)이고,
 * 마지막 자리를 채우면 자동으로 {@code CLOSED} 처리된다.
 */
@RestController
@RequestMapping("/api/mates")
@RequiredArgsConstructor
public class MateController {

    private static final String STATUS_RECRUITING = "RECRUITING";
    private static final String STATUS_CLOSED = "CLOSED";

    private static final String RESPONSE_FULL = "FULL";
    private static final String RESPONSE_JOIN_SUCCESS = "JOIN_SUCCESS";
    private static final String RESPONSE_DELETE_SUCCESS = "DELETE_SUCCESS";

    private final MatePostRepository matePostRepository;
    private final UserRepository userRepository;
    private final MateChatMessageRepository mateChatMessageRepository;

    @GetMapping
    public List<MatePost> getAllPosts() {
        return matePostRepository.findAllByOrderByIsMegaphoneDescCreatedAtDesc();
    }

    @GetMapping("/{postId}/chat")
    public ResponseEntity<List<MateChatMessage>> getChatMessages(@PathVariable Long postId) {
        return ResponseEntity.ok(
                mateChatMessageRepository.findByMatePostIdOrderBySendTimeAsc(postId));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createPost(@RequestBody MateDto dto) {
        if (dto.getUserId() == null) {
            throw new IllegalArgumentException("요청 본문에 userId가 누락되었습니다.");
        }

        User user = findUserOrThrow(dto.getUserId());
        Boolean megaphoneApplied = tryConsumeMegaphone(user, dto.isUseMegaphone());
        if (megaphoneApplied == null) {
            return ResponseEntity.status(400).body("확성기 아이템이 부족합니다.");
        }

        MatePost post = buildMatePost(dto, user, megaphoneApplied);
        return ResponseEntity.ok(matePostRepository.save(post));
    }

    /** 동행 참여. 기존 참가자는 인원수 증가 없이 재입장하고, 신규 참가자만 정원 검사를 거친다. */
    @PostMapping("/{id}/join")
    public ResponseEntity<String> joinMate(@PathVariable Long id, @RequestParam String userId) {
        MatePost post = matePostRepository.findById(id).orElseThrow();

        if (post.hasJoined(userId)) {
            return ResponseEntity.ok("이미 참여 중인 방입니다. 재입장합니다.");
        }
        if (post.getCurrentPeople() >= post.getMaxPeople()) {
            return ResponseEntity.status(400).body(RESPONSE_FULL);
        }

        admitNewMember(post, userId);
        matePostRepository.save(post);
        return ResponseEntity.ok(RESPONSE_JOIN_SUCCESS);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deletePost(@PathVariable Long id, @RequestParam String userId) {
        MatePost post =
                matePostRepository
                        .findById(id)
                        .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

        if (!post.getAuthor().getUserId().equals(userId)) {
            return ResponseEntity.status(403).body("본인이 작성한 글만 삭제할 수 있습니다.");
        }

        matePostRepository.delete(post);
        return ResponseEntity.ok(RESPONSE_DELETE_SUCCESS);
    }

    /* ============================== 내부 헬퍼 ============================== */

    private User findUserOrThrow(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new RuntimeException("해당 ID의 유저를 찾을 수 없습니다."));
    }

    /**
     * 확성기 소비 시도 결과를 반환한다.
     *
     * @return {@code true} 확성기 사용됨, {@code false} 미사용, {@code null} 아이템 부족
     */
    private Boolean tryConsumeMegaphone(User user, boolean requested) {
        if (!requested) return false;
        if (user.getMegaphoneCount() <= 0) return null;
        user.addMegaphone(-1);
        userRepository.save(user);
        return true;
    }

    private MatePost buildMatePost(MateDto dto, User user, boolean isMegaphone) {
        return MatePost.builder()
                .title(dto.getTitle())
                .content(dto.getContent())
                .targetPopup(dto.getTargetPopup())
                .maxPeople(dto.getMaxPeople())
                .currentPeople(1)
                .author(user)
                .status(STATUS_RECRUITING)
                .isMegaphone(isMegaphone)
                .build();
    }

    private void admitNewMember(MatePost post, String userId) {
        post.addJoinedUser(userId);
        post.increaseCurrentPeople();
        if (post.getCurrentPeople() == post.getMaxPeople()) {
            post.setStatus(STATUS_CLOSED);
        }
    }
}
