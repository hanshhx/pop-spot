package com.example.popspotbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 팝업 제보 요청 — Mass Assignment 방어용 DTO.
 *
 * <p>사용자가 PopupStore 엔티티 그대로 받으면 id, status, viewCount 등 민감 필드를 클라이언트가 임의로 박아 보내 그대로 저장될 수 있는 취약점이
 * 있다. → 사용자가 보내야 하는 필드만 명시적으로 받는다.
 */
@Data
public class PopupReportRequestDto {

    @NotBlank
    @Size(max = 100)
    private String name;

    @NotBlank
    @Size(max = 200)
    private String location;

    @Size(max = 50)
    private String category;

    @Size(max = 1000)
    private String description;

    @Size(max = 1000)
    private String imageUrl;

    @Size(max = 100)
    private String startDate;

    @Size(max = 100)
    private String endDate;
}
