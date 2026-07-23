package com.example.popspotbackend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 메이트(동행) 게시글 작성 DTO.
 *
 * <p>{@code @NoArgsConstructor} 는 JSON 역직렬화용. Jackson 이 setter 호출 전 빈 인스턴스를 만든다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MateDto {
    private String userId;

    @NotBlank
    @Size(max = 80)
    private String title;

    @NotBlank
    @Size(max = 1000)
    private String content;

    @NotBlank
    @Size(max = 120)
    private String targetPopup;

    @Min(2)
    @Max(10)
    private Integer maxPeople;

    /**
     * v2.12 — 상단 부스트 적용 요청. 등급별 월 한도 안에서만 허용. 옛 필드 {@code useMegaphone} 의 의미를 그대로 이어받았고, 프론트는 이
     * 이름으로 보낸다.
     */
    private boolean useBoost;
}
