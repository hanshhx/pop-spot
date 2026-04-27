package com.example.popspotbackend.dto;

import com.fasterxml.jackson.annotation.JsonProperty; // 🔥 이거 import 필수!
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class LoginResponseDto {
    private String userId;
    private String email;
    private String nickname;
    private String role;
    private String token;

    // [🔥 수정] JSON으로 나갈 때 이름을 "isPremium"으로 강제 고정
    @JsonProperty("isPremium")
    private boolean isPremium;

    private int megaphoneCount;
}