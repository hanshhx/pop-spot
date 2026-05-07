package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Locale;

/**
 * YouTube Data API v3 — 공식 음원 영상 ID 검색.
 *
 * 공식 음원 우선 채널:
 *  - "*** - Topic"  (자동 생성 아티스트 채널)
 *  - "*** VEVO"
 *  - 채널명에 "Official" 포함
 *  - 채널명이 아티스트명과 동일
 *
 * Quota 비용: search.list = 100 unit / 1회. 일일 10,000 unit 무료.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YouTubeMusicSearchService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${youtube.api-key:}")
    private String apiKey;

    public YouTubeVideo searchOfficialAudio(String artist, String track) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[YouTube] API 키 미설정 → 검색 스킵");
            return null;
        }

        String query = artist + " " + track + " official audio";

        URI uri = UriComponentsBuilder
                .fromUriString("https://www.googleapis.com/youtube/v3/search")
                .queryParam("part", "snippet")
                .queryParam("type", "video")
                .queryParam("videoCategoryId", "10")  // Music
                .queryParam("maxResults", 5)
                .queryParam("regionCode", "KR")
                .queryParam("q", query)
                .queryParam("key", apiKey)
                .build()
                .toUri();

        try {
            String response = restTemplate.getForObject(uri, String.class);
            JsonNode items = mapper.readTree(response).path("items");
            if (items.isEmpty()) return null;

            // 공식 음원 우선순위 정렬
            JsonNode best = pickBestOfficial(items, artist);
            if (best == null) best = items.get(0);

            return YouTubeVideo.builder()
                    .videoId(best.path("id").path("videoId").asText())
                    .title(best.path("snippet").path("title").asText())
                    .channelTitle(best.path("snippet").path("channelTitle").asText())
                    .thumbnail(best.path("snippet").path("thumbnails").path("high").path("url").asText())
                    .isOfficial(isOfficialChannel(best.path("snippet").path("channelTitle").asText(), artist))
                    .build();
        } catch (Exception e) {
            log.warn("[YouTube] 검색 실패: {} → {}", query, e.toString());
            return null;
        }
    }

    /** 검색 결과 중 가장 공식적인 채널의 영상을 우선 선택 */
    private JsonNode pickBestOfficial(JsonNode items, String artist) {
        JsonNode topic = null, vevo = null, official = null;
        for (JsonNode item : items) {
            String channel = item.path("snippet").path("channelTitle").asText("");
            String upper = channel.toUpperCase(Locale.ROOT);
            if (upper.endsWith("- TOPIC")) {
                if (topic == null) topic = item;
            } else if (upper.contains("VEVO")) {
                if (vevo == null) vevo = item;
            } else if (upper.contains("OFFICIAL") || channel.equalsIgnoreCase(artist)) {
                if (official == null) official = item;
            }
        }
        if (topic != null) return topic;
        if (vevo != null) return vevo;
        return official;
    }

    private boolean isOfficialChannel(String channel, String artist) {
        if (channel == null) return false;
        String upper = channel.toUpperCase(Locale.ROOT);
        return upper.endsWith("- TOPIC")
                || upper.contains("VEVO")
                || upper.contains("OFFICIAL")
                || channel.equalsIgnoreCase(artist);
    }

    @lombok.Builder
    @lombok.Getter
    public static class YouTubeVideo {
        private String videoId;
        private String title;
        private String channelTitle;
        private String thumbnail;
        private Boolean isOfficial;
    }
}
