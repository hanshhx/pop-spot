package com.example.popspotbackend.service;

import java.net.URI;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/** 카카오 Local 키워드 검색 호출 래퍼. 응답 Map 그대로 반환해 호출자가 가공한다. */
@Service
@RequiredArgsConstructor
public class KakaoApiService {

    private static final String KAKAO_LOCAL_URL =
            "https://dapi.kakao.com/v2/local/search/keyword.json";

    @Value("${kakao.api.key}")
    private String kakaoApiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> searchPopups(String keyword) {
        URI uri =
                UriComponentsBuilder.fromUriString(KAKAO_LOCAL_URL)
                        .queryParam("query", keyword)
                        .build()
                        .encode()
                        .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "KakaoAK " + kakaoApiKey);

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> response =
                restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = response.getBody();
        return body;
    }
}
