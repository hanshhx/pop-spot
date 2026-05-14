package com.example.popspotbackend.service;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/** 네이버 이미지 / 블로그 검색 API 래퍼. 팝업스토어 페이지의 보조 콘텐츠 생성에 사용된다. */
@Slf4j
@Service
public class NaverSearchService {

    private static final String IMAGE_SEARCH_URL = "https://openapi.naver.com/v1/search/image";
    private static final String BLOG_SEARCH_URL = "https://openapi.naver.com/v1/search/blog.json";

    private static final int IMAGE_DISPLAY_COUNT = 100;
    private static final int BLOG_DISPLAY_COUNT = 5;
    private static final String SORT_BY_SIMILARITY = "sim";

    private static final String QUERY_SUFFIX_POPUP = " 팝업스토어";
    private static final String QUERY_SUFFIX_REVIEW = " 후기";

    @Value("${naver.client.id}")
    private String clientId;

    @Value("${naver.client.secret}")
    private String clientSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    /** 키워드 + "팝업스토어" 로 보강한 이미지 검색. 결과 100건의 원본 링크만 추출해 반환. */
    public List<String> searchPopupImages(String keyword) {
        URI uri =
                UriComponentsBuilder.fromUriString(IMAGE_SEARCH_URL)
                        .queryParam("query", keyword + QUERY_SUFFIX_POPUP)
                        .queryParam("display", IMAGE_DISPLAY_COUNT)
                        .queryParam("sort", SORT_BY_SIMILARITY)
                        .build()
                        .encode()
                        .toUri();
        try {
            List<Map<String, Object>> items = fetchItems(uri);
            List<String> imageUrls = new ArrayList<>(items.size());
            for (Map<String, Object> item : items) {
                imageUrls.add((String) item.get("link"));
            }
            return imageUrls;
        } catch (Exception e) {
            log.warn("네이버 이미지 API 호출 실패: {}", e.toString());
            return Collections.emptyList();
        }
    }

    /** 키워드 + "후기" 블로그 검색 결과 description 을 이어붙여 한 덩어리의 텍스트로 반환. */
    public String searchBlogReviews(String keyword) {
        URI uri =
                UriComponentsBuilder.fromUriString(BLOG_SEARCH_URL)
                        .queryParam("query", keyword + QUERY_SUFFIX_REVIEW)
                        .queryParam("display", BLOG_DISPLAY_COUNT)
                        .build()
                        .encode()
                        .toUri();
        List<Map<String, Object>> items = fetchItems(uri);
        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> item : items) {
            sb.append(item.get("description")).append(' ');
        }
        return sb.toString();
    }

    /* ============================== 내부 헬퍼 ============================== */

    private List<Map<String, Object>> fetchItems(URI uri) {
        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> response =
                restTemplate.exchange(
                        uri, HttpMethod.GET, new HttpEntity<>(buildHeaders()), Map.class);
        if (response.getBody() == null) return Collections.emptyList();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items =
                (List<Map<String, Object>>) response.getBody().get("items");
        return items != null ? items : Collections.emptyList();
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Naver-Client-Id", clientId);
        headers.set("X-Naver-Client-Secret", clientSecret);
        return headers;
    }
}
