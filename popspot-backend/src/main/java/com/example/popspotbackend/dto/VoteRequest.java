package com.example.popspotbackend.dto;

import lombok.Data;

@Data
public class VoteRequest {
    private String placeId;   // 어떤 장소에 투표했는지
    private String voteType;  // "LIKE" 또는 "FIRE"
}