package com.example.popspotbackend.dto;

import java.time.LocalDateTime;

/** 동행 채팅 공개 응답. 게시글과 작성자 엔티티를 중첩 직렬화하지 않는다. */
public record MateChatMessageResponseDto(
        Long id,
        String sender,
        String message,
        String type,
        String fileUrl,
        LocalDateTime sendTime) {}
