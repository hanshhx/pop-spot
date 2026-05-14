package com.example.popspotbackend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * YouTube Data API v3 — 팝업 이름으로 영상 검색 후 첫 결과의 videoId 반환.
 *
 * <p>{@code YOUTUBE_API_KEY} 가 비어있거나 검색 실패 시 {@code null} 을 돌려준다. 영상이 안 보일 뿐 서비스 자체는 정상 동작한다. 패키지가
 * controller 인 이유는 {@code PopupStoreController} 가 같은 패키지에서 import 없이 참조하는 기존 구조를 유지하기 위함.
 */
@Slf4j
@Service
public class YouTubeService {

    private static final String SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
    private static final String PART_SNIPPET = "snippet";
    private static final String TYPE_VIDEO = "video";
    private static final int MAX_RESULTS = 1;

    @Value("${youtube.api-key:${YOUTUBE_API_KEY:}}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * @param query 검색어 (보통 팝업 이름)
     * @return YouTube videoId 또는 {@code null} (키 미설정/에러/결과 없음)
     */
    public String searchVideoId(String query) {
        if (isBlank(apiKey) || isBlank(query)) return null;

        try {
            ResponseEntity<String> resp =
                    restTemplate.exchange(
                            buildSearchUri(query), HttpMethod.GET, HttpEntity.EMPTY, String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                return null;
            }
            return extractFirstVideoId(resp.getBody());
        } catch (Exception e) {
            log.warn("YouTube 검색 실패 query='{}' err={}", query, e.getClass().getSimpleName());
            return null;
        }
    }

    private URI buildSearchUri(String query) {
        return UriComponentsBuilder.fromUriString(SEARCH_ENDPOINT)
                .queryParam("part", PART_SNIPPET)
                .queryParam("q", query)
                .queryParam("type", TYPE_VIDEO)
                .queryParam("maxResults", MAX_RESULTS)
                .queryParam("key", apiKey)
                .build()
                .encode()
                .toUri();
    }

    private String extractFirstVideoId(String body) throws Exception {
        JsonNode items = mapper.readTree(body).path("items");
        if (!items.isArray() || items.isEmpty()) return null;
        return items.get(0).path("id").path("videoId").asText(null);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
