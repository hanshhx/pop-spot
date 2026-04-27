package com.example.popspotbackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@RequiredArgsConstructor
public class PexelsService {

    @Value("${pexels.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 1. OOTD 영상 추천 (검색어 기반)
    public Map<String, String> getFashionVideo() {
        // 성수동 감성 키워드 풀
        String[] keywords = {"street fashion", "urban style", "seoul fashion", "trendy outfit", "hipster style"};
        String query = keywords[new Random().nextInt(keywords.length)];

        // Pexels Video Search API (세로 영상, 1개만 요청)
        String url = "https://api.pexels.com/videos/search?query=" + query + "&orientation=portrait&per_page=10";

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", apiKey);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode videos = root.path("videos");

            if (videos.size() > 0) {
                // 검색 결과 중 랜덤 1개 픽
                JsonNode video = videos.get(new Random().nextInt(videos.size()));

                Map<String, String> data = new HashMap<>();
                data.put("keyword", query); // 검색된 키워드 (예: urban style)
                data.put("photographer", video.path("user").path("name").asText());
                data.put("videoUrl", video.path("video_files").get(0).path("link").asText()); // 실제 영상 링크
                data.put("thumbnail", video.path("image").asText()); // 로딩용 썸네일

                return data;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}