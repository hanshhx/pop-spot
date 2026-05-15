package com.example.popspotbackend.dto;

import lombok.Data;

/**
 * 계획 보드(Planning) 의 장소 카드 투표 요청.
 *
 * <p>{@code voteType} 은 "LIKE" 또는 "FIRE" 두 종류만 허용. 컨트롤러에서 enum 변환 시 검증.
 */
@Data
public class VoteRequest {
    private String placeId;
    private String voteType;
}
