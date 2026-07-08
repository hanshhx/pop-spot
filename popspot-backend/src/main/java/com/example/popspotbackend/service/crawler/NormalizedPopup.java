package com.example.popspotbackend.service.crawler;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * LLM이 검색 snippet 들을 정규화한 결과.
 *
 * <p>{@code confidence} 0.8 이상이면 자동 게시, 미만이면 admin 검수 큐로 들어간다. 카테고리는
 * FASHION/FOOD/CULTURE/CHARACTER/BEAUTY/TECH/ETC 중 하나. 날짜는 ISO YYYY-MM-DD 형식이며 모르면 null.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NormalizedPopup {

    private String name;
    private String location;
    private String category;
    private String startDate;
    private String endDate;
    private String description;
    private String content;
    private Double confidence;
    private String error;

    /**
     * v2.33 — 다건 추출 시 이 팝업의 근거가 된 snippet 번호(1-based). Orchestrator 가 sourceUrl/sourceName 을 해당
     * snippet 으로 매핑하는 데만 쓰는 임시 힌트로, DB 에는 저장되지 않는다. 범위를 벗어나거나 null 이면 첫 snippet 으로 대체.
     */
    private Integer sourceIndex;
}
