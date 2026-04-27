package com.example.popspotbackend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@Service
public class NaverSearchService {

    @Value("${naver.client.id}")
    private String clientId;

    @Value("${naver.client.secret}")
    private String clientSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * [로직 해석]
     * 네이버 이미지 검색 API를 호출하여 최대 100개의 이미지 URL을 따옵니다.
     * display=100 파라미터를 통해 한 번에 대량의 데이터를 요청합니다.
     */
    public List<String> searchPopupImages(String keyword) {
        // [로직] 검색어에 '팝업스토어'를 붙여 정확도를 높이고 100개를 요청합니다.
        String url = "https://openapi.naver.com/v1/search/image?query=" + keyword + " 팝업스토어&display=100&sort=sim";

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Naver-Client-Id", clientId);
        headers.set("X-Naver-Client-Secret", clientSecret);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            List<Map<String, Object>> items = (List<Map<String, Object>>) response.getBody().get("items");

            List<String> imageUrls = new ArrayList<>();
            if (items != null) {
                for (Map<String, Object> item : items) {
                    // [로직] 각 아이템에서 이미지 원본 링크(link)만 뽑아서 리스트에 담습니다.
                    imageUrls.add((String) item.get("link"));
                }
            }
            return imageUrls;
        } catch (Exception e) {
            System.err.println("네이버 이미지 API 호출 실패: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * [로직 해석]
     * 블로그 리뷰 텍스트를 수집하는 메서드입니다.
     */
    public String searchBlogReviews(String keyword) {
        String url = "https://openapi.naver.com/v1/search/blog.json?query=" + keyword + " 후기&display=5";

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Naver-Client-Id", clientId);
        headers.set("X-Naver-Client-Secret", clientSecret);

        HttpEntity<String> entity = new HttpEntity<>(headers);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);

        List<Map<String, Object>> items = (List<Map<String, Object>>) response.getBody().get("items");
        StringBuilder sb = new StringBuilder();
        if (items != null) {
            for (Map<String, Object> item : items) {
                sb.append(item.get("description")).append(" ");
            }
        }
        return sb.toString();
    }
}