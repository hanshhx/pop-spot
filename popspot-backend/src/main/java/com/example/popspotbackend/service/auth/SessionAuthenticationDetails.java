package com.example.popspotbackend.service.auth;

import java.time.Instant;

/**
 * 현재 세션에서 비밀번호·소셜 로그인·2단계 인증을 마지막으로 직접 통과한 시각.
 *
 * <p>접근 토큰을 갱신한 시각과 구분한다. 리프레시 토큰만 가진 공격자가 새 JWT를 받아 회원 탈퇴 같은 민감 작업을 "방금 로그인한 작업"으로 위장하지 못하게 한다.
 */
public record SessionAuthenticationDetails(
        Instant authenticatedAt, boolean primaryAuthenticationVerified) {}
