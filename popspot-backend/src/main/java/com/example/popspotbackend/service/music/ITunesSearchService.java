package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * iTunes Search API — 무료, 키 없음, 무제한.
 * 정식 곡명/아티스트/앨범명/앨범아트(고화질) 제공.
 *
 * 문서: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ITunesSearchService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    /** 곡 검색 — 최대 N 곡 반환 */
    public List<ITunesTrack> search(String query, int limit) {
        URI uri = UriComponentsBuilder
                .fromUriString("https://itunes.apple.com/search")
                .queryParam("term", query)
                .queryParam("entity", "song")
                .queryParam("limit", Math.min(limit, 25))
                .queryParam("country", "KR")     // 한국 우선
                .queryParam("lang", "ko_kr")
                .build()
                .toUri();

        try {
            String response = restTemplate.getForObject(uri, String.class);
            JsonNode root = mapper.readTree(response);
            JsonNode results = root.path("results");

            List<ITunesTrack> tracks = new ArrayList<>();
            for (JsonNode r : results) {
                tracks.add(parseTrack(r));
            }
            return tracks;
        } catch (Exception e) {
            log.warn("[iTunes] 검색 실패: {} → {}", query, e.toString());
            return List.of();
        }
    }

    private ITunesTrack parseTrack(JsonNode r) {
        String artwork100 = r.path("artworkUrl100").asText("");
        String artworkHires = artwork100.replace("100x100", "1000x1000");

        return ITunesTrack.builder()
                .trackId(r.path("trackId").asText())
                .artistName(r.path("artistName").asText(""))
                .trackName(r.path("trackName").asText(""))
                .albumName(r.path("collectionName").asText(""))
                .artworkUrl(artwork100)
                .artworkUrlHires(artworkHires)
                .previewUrl(r.path("previewUrl").asText(null))
                .durationMs(r.path("trackTimeMillis").asInt(0))
                .build();
    }

    @lombok.Builder
    @lombok.Getter
    public static class ITunesTrack {
        private String trackId;
        private String artistName;
        private String trackName;
        private String albumName;
        private String artworkUrl;
        private String artworkUrlHires;
        private String previewUrl;
        private Integer durationMs;
    }
}
