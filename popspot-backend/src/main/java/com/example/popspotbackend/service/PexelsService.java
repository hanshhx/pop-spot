package com.example.popspotbackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Pexels Video Search API 호출 — 메인 페이지 OOTD 영상 추천.
 *
 * <p>검색어는 성수동 감성 키워드 풀에서 랜덤으로 고르고 세로 영상 10개 중 하나를 다시 랜덤으로 픽한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PexelsService {

    private static final String SEARCH_URL = "https://api.pexels.com/videos/search";
    private static final String ORIENTATION_PORTRAIT = "portrait";
    private static final int RESULTS_PER_REQUEST = 10;

    private static final String[] FASHION_KEYWORDS = {
        "street fashion", "urban style", "seoul fashion", "trendy outfit", "hipster style"
    };

    @Value("${pexels.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Random random = new Random();

    public Map<String, String> getFashionVideo() {
        String query = FASHION_KEYWORDS[random.nextInt(FASHION_KEYWORDS.length)];
        try {
            ResponseEntity<String> response =
                    restTemplate.exchange(
                            buildUri(query),
                            HttpMethod.GET,
                            new HttpEntity<>(buildHeaders()),
                            String.class);
            return pickRandomVideo(response.getBody(), query);
        } catch (Exception e) {
            log.warn("Pexels 호출 실패 query='{}' err={}", query, e.toString());
            return null;
        }
    }

    private URI buildUri(String query) {
        return UriComponentsBuilder.fromUriString(SEARCH_URL)
                .queryParam("query", query)
                .queryParam("orientation", ORIENTATION_PORTRAIT)
                .queryParam("per_page", RESULTS_PER_REQUEST)
                .build()
                .encode()
                .toUri();
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, apiKey);
        return headers;
    }

    private Map<String, String> pickRandomVideo(String body, String query) throws Exception {
        JsonNode videos = objectMapper.readTree(body).path("videos");
        if (videos.size() == 0) return null;

        JsonNode video = videos.get(random.nextInt(videos.size()));
        Map<String, String> data = new HashMap<>();
        data.put("keyword", query);
        data.put("photographer", video.path("user").path("name").asText());
        data.put("videoUrl", video.path("video_files").get(0).path("link").asText());
        data.put("thumbnail", video.path("image").asText());
        return data;
    }
}
