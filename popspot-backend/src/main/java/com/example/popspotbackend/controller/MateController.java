package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MateDto;
import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.MateChatMessageRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mates")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class MateController {

    private final MatePostRepository matePostRepository;
    private final UserRepository userRepository;
    private final MateChatMessageRepository mateChatMessageRepository;

    @GetMapping
    public List<MatePost> getAllPosts() {
        return matePostRepository.findAllByOrderByIsMegaphoneDescCreatedAtDesc();
    }

    @GetMapping("/{postId}/chat")
    public ResponseEntity<List<MateChatMessage>> getChatMessages(@PathVariable Long postId) {
        List<MateChatMessage> messages = mateChatMessageRepository.findByMatePostIdOrderBySendTimeAsc(postId);
        return ResponseEntity.ok(messages);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createPost(@RequestBody MateDto dto) {
        if (dto.getUserId() == null) {
            throw new IllegalArgumentException("요청 본문에 userId가 누락되었습니다.");
        }

        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new RuntimeException("해당 ID의 유저를 찾을 수 없습니다."));

        boolean isMegaphoneUsed = false;

        if (dto.isUseMegaphone()) {
            if (user.getMegaphoneCount() > 0) {
                user.addMegaphone(-1);
                userRepository.save(user);
                isMegaphoneUsed = true;
            } else {
                return ResponseEntity.status(400).body("확성기 아이템이 부족합니다.");
            }
        }

        MatePost post = MatePost.builder()
                .title(dto.getTitle())
                .content(dto.getContent())
                .targetPopup(dto.getTargetPopup())
                .maxPeople(dto.getMaxPeople())
                .currentPeople(1)
                .author(user)
                .status("RECRUITING")
                .isMegaphone(isMegaphoneUsed)
                .build();

        return ResponseEntity.ok(matePostRepository.save(post));
    }

    /**
     * 🔥 [수정됨] 동행 참여하기 로직
     * 프론트에서 누가 요청했는지(userId)를 받아옵니다.
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<String> joinMate(@PathVariable Long id, @RequestParam String userId) {
        MatePost post = matePostRepository.findById(id).orElseThrow();

        // 1. 이미 들어왔던 기존 멤버인지 검사 (방이 꽉 찼어도 통과)
        if (post.hasJoined(userId)) {
            return ResponseEntity.ok("이미 참여 중인 방입니다. 재입장합니다.");
        }

        // 2. 처음 온 뉴비라면, 인원수가 꽉 찼는지 확인
        if (post.getCurrentPeople() >= post.getMaxPeople()) {
            return ResponseEntity.status(400).body("FULL");
        }

        // 3. 자리가 있다면 명단에 올리고 인원수 증가!
        post.addJoinedUser(userId);
        post.increaseCurrentPeople();

        // 만약 방금 이 사람으로 인해 꽉 찼다면 마감 처리
        if (post.getCurrentPeople() == post.getMaxPeople()) {
            post.setStatus("CLOSED");
        }

        matePostRepository.save(post);
        return ResponseEntity.ok("JOIN_SUCCESS");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deletePost(@PathVariable Long id, @RequestParam String userId) {
        MatePost post = matePostRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

        if (!post.getAuthor().getUserId().equals(userId)) {
            return ResponseEntity.status(403).body("본인이 작성한 글만 삭제할 수 있습니다.");
        }

        matePostRepository.delete(post);
        return ResponseEntity.ok("DELETE_SUCCESS");
    }
}