package com.example.popspotbackend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 마이페이지 찜 목록의 각 행. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WishlistResponseDto {
    private Long wishlistId;
    private Long popupId;
    private String popupName;
    private String popupImage;
    private String location;
    private String startDate;
    private String endDate;
}
