package com.example.popspotbackend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor // 🔥 중요: JSON 파싱을 위해 기본 생성자 필수
@AllArgsConstructor
public class MateDto {
    private String userId;
    private String title;
    private String content;
    private String targetPopup;
    private Integer maxPeople;

    private boolean useMegaphone;
}