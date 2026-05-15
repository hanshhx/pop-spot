package com.example.popspotbackend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 계획 보드(Planning) 의 장소 카드.
 *
 * <p>{@code likeCount} / {@code fireCount} 는 동행자들의 투표 카운트 (좋아요 / "가자!"). 클라이언트가 STOMP 로 실시간 증분을
 * 받는다.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanningPlace {
    private String id;
    private String name;
    private double lat;
    private double lng;
    private String category;

    @Builder.Default private int likeCount = 0;
    @Builder.Default private int fireCount = 0;
}
