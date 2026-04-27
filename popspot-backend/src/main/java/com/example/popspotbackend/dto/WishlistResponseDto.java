package com.example.popspotbackend.dto; // ✅ 패키지 경로 변경됨

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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