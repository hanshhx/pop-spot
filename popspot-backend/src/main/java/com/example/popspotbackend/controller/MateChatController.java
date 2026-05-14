package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.repository.MateChatMessageRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 메이트 게시글의 실시간 채팅 채널.
 *
 * <p>STOMP 경로: 프론트는 {@code /pub/mate/chat/{postId}} 로 보내고 {@code /sub/mate/chat/{postId}} 를 구독한다.
 * 모든 메시지는 DB 에 영구 저장되며 게시글 삭제 시 cascade 로 함께 사라진다.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class MateChatController {

    private static final String SUB_TOPIC_PREFIX = "/sub/mate/chat/";

    private final SimpMessagingTemplate messagingTemplate;
    private final MateChatMessageRepository mateChatMessageRepository;
    private final MatePostRepository matePostRepository;

    @MessageMapping("/mate/chat/{postId}")
    public void sendMessage(@DestinationVariable Long postId, MateChatMessage message) {
        log.debug("[MateChat] postId={} 수신", postId);

        MatePost post = findPostOrThrow(postId);
        message.setMatePost(post);
        message.setSendTime(LocalDateTime.now());
        mateChatMessageRepository.save(message);

        messagingTemplate.convertAndSend(SUB_TOPIC_PREFIX + postId, message);
    }

    /** 방장 권한으로 게시글을 폭파한다. 채팅 메시지는 cascade 로 함께 삭제된다. */
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deletePost(@PathVariable Long id, @RequestParam String userId) {
        MatePost post = findPostOrThrow(id);
        if (!post.getAuthor().getUserId().equals(userId)) {
            return ResponseEntity.status(403).body("권한이 없습니다.");
        }
        matePostRepository.delete(post);
        return ResponseEntity.ok("DELETE_SUCCESS");
    }

    private MatePost findPostOrThrow(Long postId) {
        return matePostRepository
                .findById(postId)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));
    }
}
