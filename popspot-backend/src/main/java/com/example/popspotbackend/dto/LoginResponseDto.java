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
    private String userId;
    private String email;
    private String nickname;
    private String role;
    private String token;

    @JsonProperty("isPremium")
    private boolean isPremium;

    private int megaphoneCount;
}
