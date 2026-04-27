package com.example.popspotbackend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanningPlace {
    private String id;          // 장소 ID (Kakao Map ID 등)
    private String name;        // 장소 이름
    private double lat;         // 위도
    private double lng;         // 경도
    private String category;    // 카테고리

    // 🔥 [추가됨] 투표 카운트
    @Builder.Default
    private int likeCount = 0;  // 👍 좋아요
    @Builder.Default
    private int fireCount = 0;  // 🔥 가자
}