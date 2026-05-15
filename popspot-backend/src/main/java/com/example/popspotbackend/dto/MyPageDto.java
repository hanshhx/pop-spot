package com.example.popspotbackend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

/**
 * 마이페이지 요약 응답.
 *
 * <p>{@link LoginResponseDto} 와 동일한 이유로 {@code isPremium} 키를 강제 고정.
 */
@Data
@Builder
public class MyPageDto {
    private String nickname;

    @JsonProperty("isPremium")
    private boolean isPremium;

    private LocalDateTime premiumExpiryDate;
    private int megaphoneCount;
    private int stampCount;
    private int likeCount;
    private int reviewCount;
}
