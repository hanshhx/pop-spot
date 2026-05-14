package com.example.popspotbackend.service.crawler;

import lombok.Builder;
import lombok.Data;

/**
 * 외부 검색 API 1건의 raw snippet (Naver / Kakao 공통).
 *
 * <p>LLM 정규화 입력으로 사용된다. 저작권법/약관 회색지대 회피를 위해 검색 API 가 제공하는 title / description / link 만 사용하고 본문은 직접
 * 스크래핑하지 않는다. {@code sourceName} 은 {@code NAVER_BLOG}, {@code NAVER_NEWS}, {@code KAKAO_WEB} 등의 코드.
 */
@Data
@Builder
public class PopupCrawlSource {

    private String sourceName;
    private String title;
    private String description;
    private String link;
    private String postDate;
}
