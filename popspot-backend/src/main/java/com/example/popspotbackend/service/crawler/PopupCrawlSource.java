package com.example.popspotbackend.service.crawler;

import lombok.Builder;
import lombok.Data;

/**
 * 외부 검색 API 1건의 raw 결과 (Naver/Kakao 공통).
 * Gemini 정규화 입력으로 사용.
 *
 * 정책: title/description/link 만 사용. 본문 직접 스크래핑 X (저작권법/TOS 회색지대 회피).
 */
@Data
@Builder
public class PopupCrawlSource {
    /** 출처 종류: "NAVER_BLOG" / "NAVER_NEWS" / "KAKAO_WEB" 등 */
    private String sourceName;

    /** 검색 결과 페이지 제목 (HTML 태그 제거된 plain text) */
    private String title;

    /** 검색 결과 요약 / snippet */
    private String description;

    /** 원본 페이지 URL — 저작권법 출처표시 + takedown 요청 식별 */
    private String link;

    /** 게시일 (ISO 형식 또는 raw, Gemini 가 알아서 파싱) */
    private String postDate;
}
