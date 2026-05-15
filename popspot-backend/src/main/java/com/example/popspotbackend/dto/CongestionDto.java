package com.example.popspotbackend.dto;

import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 성수동 실시간 혼잡도 + 날씨 응답.
 *
 * <p>{@code level} 은 "여유 / 보통 / 약간 붐빔 / 붐빔" 4단계. {@code forecast} 는 12시간 시간별 예측 인구 ({"time":
 * "14:00", "pop": "3200"} 형태). {@code ageRates} 는 연령대별 점유 비율.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class CongestionDto {
    private String level;
    private String message;
    private int minPop;
    private int maxPop;

    private String temp;
    private String sky;
    private String rainChance;
    private List<Map<String, String>> forecast;
    private Map<String, Double> ageRates;
}
