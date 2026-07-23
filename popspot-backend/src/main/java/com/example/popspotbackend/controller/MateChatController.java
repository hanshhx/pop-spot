package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MateChatMessageRequestDto;
import com.example.popspotbackend.dto.MateChatMessageResponseDto;
import com.example.popspotbackend.service.ChatIdentityResolver;
import com.example.popspotbackend.service.MateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * 메이트 게시글의 실시간 채팅 채널.
 *
 * <p>STOMP 경로: 프론트는 {@code /pub/mate/chat/{postId}} 로 보내고 {@code /sub/mate/chat/{postId}} 를 구독한다.
 * 영속화 및 게시글 조회는 {@link MateService} 가 담당하고, 컨트롤러는 라우팅 + 브로드캐스트만 책임진다.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class MateChatController {

    private static final String SUB_TOPIC_PREFIX = "/sub/mate/chat/";

    private final SimpMessagingTemplate messagingTemplate;
    private final MateService mateService;
    private final ChatIdentityResolver identityResolver;

    @MessageMapping("/mate/chat/{postId}")
    public void sendMessage(
            @DestinationVariable Long postId,
            @Valid MateChatMessageRequestDto message,
            SimpMessageHeaderAccessor headerAccessor) {
        // 보안: sender 를 클라이언트 값이 아닌 인증 세션 기준으로 서버가 확정(사칭 차단).
        String userId = identityResolver.requireUserId(headerAccessor);
        String sender = identityResolver.resolveSender(headerAccessor);
        log.debug("[MateChat] postId={} sender={} 수신", postId, sender);
        MateChatMessageResponseDto saved =
                mateService.persistChatMessage(postId, message, sender, userId);
        messagingTemplate.convertAndSend(SUB_TOPIC_PREFIX + postId, saved);
    }
}
