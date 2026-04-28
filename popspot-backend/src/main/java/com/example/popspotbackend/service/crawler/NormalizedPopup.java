package com.example.popspotbackend.service.crawler;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Gemini 가 search snippet 을 정리한 결과.
 * confidence 가 낮으면 admin 검수 큐로, 높으면 자동 게시.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NormalizedPopup {
    /** 팝업 이름 */
    private String name;

    /** 한글 주소 (서울 ___구 ___) — 없으면 빈 문자열 */
    private String location;

    /** 카테고리 (FASHION/FOOD/CULTURE/CHARACTER/BEAUTY/TECH/ETC) */
    private String category;

    /** 시작일 ISO YYYY-MM-DD — 모르면 null */
    private String startDate;

    /** 종료일 ISO YYYY-MM-DD — 모르면 null */
    private String endDate;

    /** 한 줄 설명 */
    private String description;

    /** 전체 설명 (description 보다 김) */
    private String content;

    /** 신뢰도 0.00 ~ 1.00 — 0.8 이상이면 자동 게시 */
    private Double confidence;

    /** 정규화 실패 사유 (null 이면 정상) */
    private String error;
}
