package com.example.popspotbackend.dto;

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
    private String title;
    private String content;
    private String targetPopup;
    private Integer maxPeople;
    private boolean useMegaphone;
}
