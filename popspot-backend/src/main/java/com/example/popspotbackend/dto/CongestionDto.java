// 👇 [중요] 여기도 패키지 이름을 맞췄습니다.
package com.example.popspotbackend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CongestionDto {
    private String level;   // 혼잡도 등급 (여유, 붐빔 등)
    private String message; // 상세 메시지
    private int minPop;     // 최소 인구
    private int maxPop;     // 최대 인구

    private String temp;         // 기온
    private String sky;          // 하늘 상태 (맑음, 흐림)
    private String rainChance;   // 강수 확률
    private List<Map<String, String>> forecast; // 12시간 예측 (시간, 인구수)
    private Map<String, Double> ageRates;       // 연령별 비율
}