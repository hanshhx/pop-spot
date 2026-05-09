package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Spotify Web API 클라이언트 (검색 전용).
 *
 * 1. Client Credentials Flow 로 access token 발급
 * 2. /v1/search?type=track 으로 곡 메타데이터 조회
 * 3. 토큰은 메모리 캐시 (만료 직전까지 재사용)
 *
 * 검색 quota 는 사실상 무제한(분당 ~100 호출)이라 검색 트래픽 부담을
 * 모두 Spotify 가 받는다. YouTube 는 재생 시점에만 호출.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpotifySearchService {

    private static final String TOKEN_URL = "https://accounts.spotify.com/api/token";
    private static final String SEARCH_URL = "https://api.spotify.com/v1/search";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();
    private final SearchSuggestService suggestService;
    private final MusicQueryNormalizationService queryNormalizer;

    @Value("${spotify.client-id:}")
    private String clientId;

    @Value("${spotify.client-secret:}")
    private String clientSecret;

    /** 메모리 캐시된 access token */
    private volatile String cachedToken;
    private volatile LocalDateTime tokenExpiresAt;

    public List<SpotifyTrack> search(String query, int limit) {
        if (query == null || query.trim().length() < 2) return List.of();
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            log.warn("[Spotify] client credentials 미설정 → 검색 스킵");
            return List.of();
        }

        String token = ensureAccessToken();
        if (token == null) return List.of();

        // 영문/숫자 → 글로벌 단독 (가장 정확)
        if (!containsHangul(query)) {
            return callSearch(token, query, limit, null);
        }

        // 한국어 검색은 다음 순서로 시도 — 정확도가 가장 높은 결과를 채택한다.
        //   1) 원본 한국어로 KR 마켓
        //   2) 약하면 → Groq AI 가 영문 표기로 변환한 검색어로 글로벌 (가장 강력)
        //   3) 약하면 → YouTube Suggest 후보로 추가 시도
        //   4) 약하면 → 원본 한국어로 글로벌 검색
        //   5) 결과들을 우선순위대로 합쳐서 반환
        List<SpotifyTrack> kr = callSearch(token, query, limit, "KR");
        if (isStrongMatch(kr, query)) return kr;

        // Groq AI 정규화 — "뉴진스" → "NewJeans" 같이 영문 표기 변환 (가장 신뢰도 높음)
        String normalizedQuery = queryNormalizer.normalize(query);
        List<SpotifyTrack> aiResults = List.of();
        if (!normalizedQuery.equalsIgnoreCase(query)) {
            aiResults = callSearch(token, normalizedQuery, limit, null);
            if (isStrongMatch(aiResults, normalizedQuery)) return aiResults;
        }

        List<SpotifyTrack> suggested = searchViaSuggestion(token, query, limit);
        if (isStrongMatch(suggested, query)) return suggested;

        List<SpotifyTrack> global = callSearch(token, query, limit, null);

        // 우선순위: AI 정규화 > 자동완성 정규화 > KR 직접 > 글로벌
        List<SpotifyTrack> merged = new ArrayList<>();
        merged = mergeUnique(merged, aiResults, limit);
        merged = mergeUnique(merged, suggested, limit);
        merged = mergeUnique(merged, kr, limit);
        merged = mergeUnique(merged, global, limit);
        return merged;
    }

    /**
     * YouTube Suggest 가 추천한 정확한 표기(예: "뉴진스" → "NewJeans Super Shy") 로
     * Spotify 를 다시 검색한다. Spotify 의 한국어 매칭이 약한 곡들을
     * 자동완성 데이터의 도움을 받아 잡아낸다.
     */
    private List<SpotifyTrack> searchViaSuggestion(String token, String query, int limit) {
        try {
            List<String> suggestions = suggestService.suggest(query, 3);
            for (String candidate : suggestions) {
                if (candidate == null || candidate.equalsIgnoreCase(query)) continue;
                List<SpotifyTrack> result = callSearch(token, candidate, limit, null);
                if (isStrongMatch(result, query) || isStrongMatch(result, candidate)) {
                    return result;
                }
            }
        } catch (Exception e) {
            log.debug("[Spotify] 자동완성 정규화 실패: {}", e.toString());
        }
        return List.of();
    }

    /**
     * 결과가 검색어와 충분히 관련 있는지 확인.
     * - 결과 비어있지 않고
     * - 적어도 한 곡의 trackName/artistName 에 검색어가 포함됨
     */
    private boolean isStrongMatch(List<SpotifyTrack> results, String query) {
        if (results == null || results.isEmpty()) return false;
        String q = query.toLowerCase().trim();
        String compactQ = q.replaceAll("\\s+", "");
        if (compactQ.isEmpty()) return false;

        for (SpotifyTrack t : results) {
            String name = (t.getTrackName() == null ? "" : t.getTrackName()).toLowerCase();
            String artist = (t.getArtistName() == null ? "" : t.getArtistName()).toLowerCase();
            if (name.contains(q) || artist.contains(q)
                    || name.replaceAll("\\s+", "").contains(compactQ)
                    || artist.replaceAll("\\s+", "").contains(compactQ)) {
                return true;
            }
        }
        return false;
    }

    /** 단일 검색 호출. market 이 null 이면 글로벌 검색. */
    private List<SpotifyTrack> callSearch(String token, String query, int limit, String market) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        StringBuilder url = new StringBuilder(SEARCH_URL)
                .append("?q=").append(java.net.URLEncoder.encode(query.trim(), StandardCharsets.UTF_8))
                .append("&type=track")
                .append("&limit=").append(Math.min(Math.max(limit, 1), 50));
        if (market != null) url.append("&market=").append(market);

        try {
            var response = restTemplate.exchange(
                    url.toString(), HttpMethod.GET, new HttpEntity<>(headers), String.class);
            JsonNode tracks = mapper.readTree(response.getBody()).path("tracks").path("items");

            List<SpotifyTrack> result = new ArrayList<>();
            for (JsonNode item : tracks) result.add(parseTrack(item));
            return result;
        } catch (Exception e) {
            log.warn("[Spotify] 검색 실패 (market={}): {} → {}", market, query, e.toString());
            return List.of();
        }
    }

    /** 두 결과를 spotifyId 기준 중복 제거하면서 합치고 limit 까지 자른다. */
    private List<SpotifyTrack> mergeUnique(List<SpotifyTrack> base, List<SpotifyTrack> incoming, int limit) {
        java.util.Set<String> seen = new java.util.HashSet<>();
        List<SpotifyTrack> merged = new ArrayList<>();
        for (SpotifyTrack t : base) {
            if (t.getSpotifyId() != null && seen.add(t.getSpotifyId())) merged.add(t);
            if (merged.size() >= limit) return merged;
        }
        for (SpotifyTrack t : incoming) {
            if (t.getSpotifyId() != null && seen.add(t.getSpotifyId())) merged.add(t);
            if (merged.size() >= limit) return merged;
        }
        return merged;
    }

    /** 토큰이 만료 직전이면 새로 발급, 아니면 캐시된 거 반환 */
    private synchronized String ensureAccessToken() {
        if (cachedToken != null
                && tokenExpiresAt != null
                && tokenExpiresAt.isAfter(LocalDateTime.now().plusSeconds(30))) {
            return cachedToken;
        }

        String basic = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + basic);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");

        try {
            var response = restTemplate.exchange(
                    TOKEN_URL, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            JsonNode root = mapper.readTree(response.getBody());

            cachedToken = root.path("access_token").asText();
            int expiresIn = root.path("expires_in").asInt(3600);
            tokenExpiresAt = LocalDateTime.now().plusSeconds(expiresIn);
            return cachedToken;
        } catch (Exception e) {
            log.error("[Spotify] 토큰 발급 실패 → {}", e.toString());
            return null;
        }
    }

    private SpotifyTrack parseTrack(JsonNode item) {
        JsonNode album = item.path("album");
        JsonNode images = album.path("images");

        // images 는 큰 사이즈 → 작은 사이즈 순서. 0번이 보통 640x640
        String hires = images.size() > 0 ? images.get(0).path("url").asText("") : "";
        String thumb = images.size() > 1 ? images.get(1).path("url").asText(hires) : hires;

        StringBuilder artists = new StringBuilder();
        for (JsonNode a : item.path("artists")) {
            if (artists.length() > 0) artists.append(", ");
            artists.append(a.path("name").asText(""));
        }

        return SpotifyTrack.builder()
                .spotifyId(item.path("id").asText(""))
                .trackName(item.path("name").asText(""))
                .artistName(artists.toString())
                .albumName(album.path("name").asText(""))
                .artworkUrl(thumb)
                .artworkUrlHires(hires)
                .previewUrl(item.path("preview_url").isNull()
                        ? null : item.path("preview_url").asText(null))
                .durationMs(item.path("duration_ms").asInt(0))
                .build();
    }

    private boolean containsHangul(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if ((c >= 0xAC00 && c <= 0xD7A3)
                    || (c >= 0x1100 && c <= 0x11FF)
                    || (c >= 0x3130 && c <= 0x318F)) return true;
        }
        return false;
    }

    @Builder
    @Getter
    public static class SpotifyTrack {
        private String spotifyId;
        private String trackName;
        private String artistName;
        private String albumName;
        private String artworkUrl;
        private String artworkUrlHires;
        private String previewUrl;
        private Integer durationMs;
    }
}
