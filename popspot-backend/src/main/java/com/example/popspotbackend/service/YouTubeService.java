package com.example.popspotbackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class YouTubeService {

    // application.yml에 youtube.api-key로 저장하거나, 여기에 직접 넣어서 테스트하세요.
    @Value("${youtube.api-key:AIzaSyDvOlaebqp0oV2zcXXn7jfox_GNcU9kgq4}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String searchVideoId(String query) {
        try {
            // 검색어: "팝업이름" + " 후기" (예: 네이버웹툰 팝업 후기)
            String searchUrl = "https://www.googleapis.com/youtube/v3/search"
                    + "?part=snippet&type=video&maxResults=1&q=" + query + " 팝업스토어 후기"
                    + "&key=" + apiKey;

            String response = restTemplate.getForObject(searchUrl, String.class);
            JsonNode root = objectMapper.readTree(response);

            // 검색 결과 중 첫 번째 영상의 ID 추출
            if (root.path("items").size() > 0) {
                return root.path("items").get(0).path("id").path("videoId").asText();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null; // 검색 실패 시 null 반환 (프론트에서 이미지로 대체)
    }
}