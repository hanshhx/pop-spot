package com.example.popspotbackend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * 로그인 성공 응답.
 *
 * <p>{@code isPremium} 은 boolean 이라 Jackson 이 기본적으로 {@code premium} 으로 직렬화한다. 프론트가 {@code
 * isPremium} 키를 기대하므로 {@link JsonProperty} 로 키 이름을 강제 고정.
 */
@Getter
@Builder
@AllArgsConstructor
public class LoginResponseDto {

    /**
     * 2단계 인증이 남았는가.
     *
     * <p>참이면 {@code token} 이 <b>비어 있다</b>. 프론트는 이 값을 보고 6자리 입력 화면으로 넘어가 {@code challengeToken} 과 함께
     * {@code /api/v1/auth/login/totp} 로 보낸다.
     *
     * <p>거짓이거나 없으면 예전과 똑같다 — 기능을 끈 상태이거나 2단계 인증을 안 쓰는 계정이다.
     */
    @Builder.Default private boolean totpRequired = false;

    /**
     * 2단계 인증을 이어서 하기 위한 단기 표. <b>이것만으로는 아무 권한도 없다.</b>
     *
     * <p>비밀번호를 맞힌 사람이라는 사실만 담는다. 여기에 JWT 를 주고 나중에 확인하는 방식이면 코드를 못 맞혀도 이미 로그인된 것이라 2단계 인증이 무의미해진다.
     */
    private String challengeToken;

    private String userId;
    private String email;
    private String nickname;
    private String role;
    private String token;

    @JsonProperty("isPremium")
    private boolean isPremium;

    private int megaphoneCount;
}
