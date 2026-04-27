package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.repository.MateChatMessageRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.LocalDateTime;

@Controller
@RequiredArgsConstructor
public class MateChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MateChatMessageRepository mateChatMessageRepository;
    private final MatePostRepository matePostRepository;

    // 🔥 프론트의 destination: /pub/mate/chat/{postId} 에서 /pub을 제외한 경로
    @MessageMapping("/mate/chat/{postId}")
    public void sendMessage(@DestinationVariable Long postId, MateChatMessage message) {

        // [디버깅 로그] 이 로그가 백엔드 터미널에 찍히는지 꼭 확인하세요!
        System.out.println(">>> 채팅 수신됨! 방번호: " + postId + ", 메시지: " + message.getMessage());

        // 1. 해당 채팅방(게시글) 정보 가져오기
        MatePost post = matePostRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

        // 2. 메시지 엔티티 보강 (어느 방인지, 언제 보냈는지)
        message.setMatePost(post);
        message.setSendTime(LocalDateTime.now());

        // 3. 🔥 DB에 영구 저장 (이게 실행되어야 DB에 찍힙니다!)
        mateChatMessageRepository.save(message);

        // 4. 구독 중인 모든 유저에게 메시지 실시간 전달
        messagingTemplate.convertAndSend("/sub/mate/chat/" + postId, message);
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deletePost(@PathVariable Long id, @RequestParam String userId) {
        MatePost post = matePostRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

        // 🔥 권한 확인: 방장(작성자)만 폭파 가능
        if (!post.getAuthor().getUserId().equals(userId)) {
            return ResponseEntity.status(403).body("권한이 없습니다.");
        }

        // 🔥 삭제 실행: MatePost 엔티티에 cascade = CascadeType.ALL이 설정되어 있다면
        // 게시글 삭제 시 DB의 채팅 메시지도 자동으로 함께 삭제됩니다.
        matePostRepository.delete(post);

        return ResponseEntity.ok("DELETE_SUCCESS");
    }
}