package com.example.popspotbackend.dto;

/** 동행 게시판에 공개해도 되는 작성자 정보만 담는다. */
public record MateAuthorResponseDto(
        String userId, String nickname, String picture, boolean isPremium, Double mannerTemp) {}
