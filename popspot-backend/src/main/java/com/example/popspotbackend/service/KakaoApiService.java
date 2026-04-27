package com.example.popspotbackend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class KakaoApiService {

    @Value("${kakao.api.key}")
    private String kakaoApiKey;

    private final String KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

    public Map<String, Object> searchPopups(String keyword) {
        RestTemplate restTemplate = new RestTemplate();

        // 1. 헤더 설정 (인증)
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "KakaoAK " + kakaoApiKey);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        // 2. API 호출
        String url = KAKAO_LOCAL_URL + "?query=" + keyword;
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);

        return response.getBody();
    }
}