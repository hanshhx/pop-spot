package com.example.popspotbackend.dto;

import com.fasterxml.jackson.annotation.JsonProperty; // 🔥 이 import 추가!
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class MyPageDto {
    private String nickname;

    // 🔥 [수정] JSON으로 나갈 때 이름을 "isPremium"으로 강제 고정
    @JsonProperty("isPremium")
    private boolean isPremium;

    private LocalDateTime premiumExpiryDate; // 만료일
    private int megaphoneCount; // 확성기 개수
    private int stampCount;     // 스탬프 개수
    private int likeCount;      // 찜한 개수
    private int reviewCount;    // 리뷰 개수
}