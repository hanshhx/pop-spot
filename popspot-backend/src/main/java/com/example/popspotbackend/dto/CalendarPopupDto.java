package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.PopupStore;
import lombok.Builder;
import lombok.Data;

/**
 * 프론트 캘린더 위젯이 소비하는 가벼운 DTO.
 * (전체 PopupStore 직렬화는 페이로드 너무 큼 + lazy 로딩 위험)
 */
@Data
@Builder
public class CalendarPopupDto {
    private Long id;
    private String name;
    private String location;
    private String category;
    private String startDate;
    private String endDate;
    private String imageUrl;
    private String sourceType;     // MANUAL / CRAWLED — 프론트에서 "자동수집" 뱃지 표시 가능
    private String sourceUrl;       // 출처 링크 — 저작권법 출처표시

    public static CalendarPopupDto fromEntity(PopupStore p) {
        return CalendarPopupDto.builder()
                .id(p.getId())
                .name(p.getName())
                .location(p.getLocation())
                .category(p.getCategory())
                .startDate(p.getStartDate())
                .endDate(p.getEndDate())
                .imageUrl(p.getImageUrl())
                .sourceType(p.getSourceType())
                .sourceUrl(p.getSourceUrl())
                .build();
    }
}
