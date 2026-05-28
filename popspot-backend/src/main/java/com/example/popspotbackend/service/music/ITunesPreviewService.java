package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * v2.21-S15 — iTunes Search API 로 30~90초 preview_url 보충.
 *
 * <p>배경: Spotify 가 2024-11 부터 신규 앱의 {@code preview_url} 을 null 로 반환. Free / 미연결 사용자가 깨끗한 미리듣기를 못 듣고
 * YouTube 로 폴백되던 문제 해결. Apple iTunes 는 아직 preview_url (90초 m4a) 을 무료 / 키 불필요로 제공한다.
 *
 * <p>흐름: Spotify 메타 (artist + track) 로 iTunes 검색 → 가장 유사한 곡의 previewUrl 반환. 매칭 실패 시 null (그 트랙만
 * YouTube 폴백 유지).
 *
 * <p>호출 시점: 재생 직전 lazy (MusicService.ensurePreviewUrl). 한 번 채우면 DB 캐시라 재호출 없음.
 */
@Slf4j
@Service
public class ITunesPreviewService {

    private static final String SEARCH_URL = "https://itunes.apple.com/search";
    private static final int RESULT_LIMIT = 5;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 곡의 iTunes preview_url 검색. 못 찾으면 null.
     *
     * @param artist 아티스트명
     * @param track 곡명
     * @return 90초 preview mp3/m4a 직링크 또는 null
     */
    public String findPreviewUrl(String artist, String track) {
        if (isBlank(artist) && isBlank(track)) return null;

        String term = (safe(artist) + " " + safe(track)).trim();
        String url =
                UriComponentsBuilder.fromUriString(SEARCH_URL)
                        .queryParam("term", term)
                        .queryParam("media", "music")
                        .queryParam("entity", "song")
                        .queryParam("limit", RESULT_LIMIT)
                        .build()
                        .encode(StandardCharsets.UTF_8)
                        .toUriString();

        try {
            String response = restTemplate.getForObject(url, String.class);
            JsonNode results = objectMapper.readTree(response).path("results");
            if (!results.isArray() || results.isEmpty()) return null;

            JsonNode best = pickBest(results, artist, track);
            if (best == null) return null;

            String preview = best.path("previewUrl").asText(null);
            return (preview == null || preview.isBlank()) ? null : preview;
        } catch (Exception e) {
            log.warn("[iTunes] preview 검색 실패: {} → {}", term, e.toString());
            return null;
        }
    }

    /** 결과 중 아티스트 + 트랙명이 가장 잘 맞는 항목 선택. 느슨한 부분일치 우선, 없으면 첫 결과. */
    private JsonNode pickBest(JsonNode results, String artist, String track) {
        JsonNode firstWithPreview = null;
        for (JsonNode item : results) {
            String preview = item.path("previewUrl").asText("");
            if (preview.isBlank()) continue;
            if (firstWithPreview == null) firstWithPreview = item;

            String itemArtist = item.path("artistName").asText("");
            String itemTrack = item.path("trackName").asText("");
            boolean artistOk = isBlank(artist) || containsLoose(itemArtist, artist);
            boolean trackOk = isBlank(track) || containsLoose(itemTrack, track);
            if (artistOk && trackOk) return item;
        }
        // 정확 매칭 없으면 preview 있는 첫 결과 (검색 정확도는 iTunes 가 이미 정렬).
        return firstWithPreview;
    }

    private boolean containsLoose(String haystack, String needle) {
        if (haystack == null || needle == null) return false;
        return normalize(haystack).contains(normalize(needle));
    }

    private String normalize(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("[\\s'\\\"`()\\[\\].,!?·\\-_/]", "");
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }
}
