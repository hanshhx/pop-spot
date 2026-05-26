package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.PopupStore;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import lombok.Builder;
import lombok.Data;

/**
 * Algolia 인덱싱용 경량 DTO.
 *
 * <p>Algolia 는 ID 필드를 반드시 {@code objectID} (대소문자 포함) 라는 이름의 String 으로 받는다.
 *
 * <p>v2.13 부터 정확도/유효 필드를 함께 인덱싱한다. 프론트 SearchBox 가 이 필드를 보고 신뢰도 미달 / 만료된 row 를 노출에서 제외하며, 백엔드도 인덱싱
 * 시점에 필터를 강제한다 (이중 방어).
 */
@Data
@Builder
public class PopupSearchDto {

    /** "yyyy-MM-dd" 또는 null. */
    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private String objectID;
    private String name;
    private String location;
    private String category;
    private String content;
    private String imageUrl;

    /** AUTO_PUBLISHED / APPROVED / null(레거시). 프론트 필터링에 활용. */
    private String reviewStatus;

    /** OPEN / EXPIRED / PENDING ... — 만료 row 를 검색 결과에서 가리기 위해 함께 노출. */
    private String status;

    /** 0.00 ~ 1.00 사이. 0.80 미만은 인덱싱 자체에서 거부되지만 프론트도 한 번 더 가드. */
    private Double confidence;

    /** ISO yyyy-MM-dd. endDate 가 오늘보다 과거면 프론트가 결과에서 제외. */
    private String endDate;

    public static PopupSearchDto fromEntity(PopupStore popup) {
        return PopupSearchDto.builder()
                .objectID(String.valueOf(popup.getId()))
                .name(popup.getName())
                .location(popup.getLocation())
                .category(popup.getCategory())
                .content(popup.getContent())
                .imageUrl(popup.getImageUrl())
                .reviewStatus(popup.getReviewStatus())
                .status(popup.getStatus())
                .confidence(toDouble(popup.getConfidenceScore()))
                .endDate(formatDate(popup.getEndDate()))
                .build();
    }

    private static Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private static String formatDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw).format(ISO_DATE);
        } catch (Exception ignored) {
            return raw; // 파싱 실패해도 그대로 노출 — 클라가 best-effort 처리
        }
    }
}
