package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.PopupStore;
import lombok.Builder;
import lombok.Data;

/**
 * Algolia 인덱싱용 경량 DTO.
 *
 * <p>Algolia 는 ID 필드를 반드시 {@code objectID} (대소문자 포함) 라는 이름의 String 으로 받는다.
 */
@Data
@Builder
public class PopupSearchDto {
    private String objectID;
    private String name;
    private String location;
    private String category;
    private String content;
    private String imageUrl;

    public static PopupSearchDto fromEntity(PopupStore popup) {
        return PopupSearchDto.builder()
                .objectID(String.valueOf(popup.getId()))
                .name(popup.getName())
                .location(popup.getLocation())
                .category(popup.getCategory())
                .content(popup.getContent())
                .imageUrl(popup.getImageUrl())
                .build();
    }
}
