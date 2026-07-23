package com.example.popspotbackend.dto;

import java.time.LocalDateTime;

/** 동행 게시글 공개 응답. JPA 엔티티와 사용자 민감정보는 API 경계를 넘지 않는다. */
public record MatePostResponseDto(
        Long id,
        String title,
        String content,
        String status,
        String targetPopup,
        int maxPeople,
        int currentPeople,
        MateAuthorResponseDto author,
        LocalDateTime createdAt,
        boolean isMegaphone) {}
