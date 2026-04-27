package com.example.popspotbackend.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;

/**
 * YouTube Data API v3 — 팝업 이름으로 영상 검색 후 첫 결과 영상 ID 반환.
 *
 * 동작 모드:
 *   - YOUTUBE_API_KEY 환경변수가 설정돼 있으면 실제 API 호출
 *   - 미설정이면 안전하게 null 반환 (서비스 정상 동작 — 단지 영상이 안 보일 뿐)
 *
 * 환경변수 (선택사항):
 *   YOUTUBE_API_KEY=...
 *
 * 발급: https://console.cloud.google.com/apis/library/youtube.googleapis.com
 *
 * 패키지가 controller 인 이유: 기존 PopupStoreController 가 같은 패키지에서 import 없이
 * 참조하고 있던 흐름을 유지하기 위함.
 */
@Slf4j
@Service
public class YouTubeService {

    @Value("${youtube.api-key:${YOUTUBE_API_KEY:}}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * 검색어로 첫 번째 영상의 videoId 를 반환. 키 미설정/에러 시 null.
     *
     * @param query 검색어 (보통 팝업 이름)
     * @return YouTube videoId 또는 null
     */
    public String searchVideoId(String query) {
        if (apiKey == null || apiKey.isBlank()) {
            // API 키 미설정 — 서비스 정상 동작. 영상만 표시 안 됨.
            return null;
        }
        if (query == null || query.isBlank()) {
            return null;
        }

        try {
            // Spring 6.2+ 에서 fromHttpUrl 제거 → fromUriString 으로 통일
            URI uri = UriComponentsBuilder.fromUriString("https://www.googleapis.com/youtube/v3/search")
                    .queryParam("part", "snippet")
                    .queryParam("q", query)
                    .queryParam("type", "video")
                    .queryParam("maxResults", 1)
                    .queryParam("key", apiKey)
                    .build()
                    .encode()
                    .toUri();

            ResponseEntity<String> resp = restTemplate.exchange(uri, HttpMethod.GET, HttpEntity.EMPTY, String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return null;

            JsonNode root = mapper.readTree(resp.getBody());
            JsonNode items = root.path("items");
            if (!items.isArray() || items.isEmpty()) return null;

            return items.get(0).path("id").path("videoId").asText(null);
        } catch (Exception e) {
            log.warn("YouTube 검색 실패 query='{}' err={}", query, e.getClass().getSimpleName());
            return null;
        }
    }
}
