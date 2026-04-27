package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.PopupStore;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PopupSearchDto {
    private String objectID; // Algolia 필수 필드 (String ID)
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
                // 🔥 [수정] getMainImageUrl() -> getImageUrl()로 변경
                .imageUrl(popup.getImageUrl())
                .build();
    }
}