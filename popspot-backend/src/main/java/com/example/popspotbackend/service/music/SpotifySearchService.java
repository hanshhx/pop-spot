package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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

/**
 * Spotify Web API 클라이언트 (검색 전용).
 *
 * <p>Client Credentials Flow 로 access token 을 발급받아 메모리 캐시한 뒤, /v1/search 엔드포인트로 곡 메타데이터를 조회한다.
 *
 * <p>한국어 검색은 KR 마켓 직접 검색이 종종 약하기 때문에 AI 정규화 + 자동완성 정규화 + 글로벌 검색을 단계별로 합치는 5단계 폴백을 적용한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpotifySearchService {

    private static final String TOKEN_URL = "https://accounts.spotify.com/api/token";
    private static final String SEARCH_URL = "https://api.spotify.com/v1/search";
    private static final String KOREA_MARKET = "KR";

    private static final int MIN_QUERY_LENGTH = 2;
    private static final int MAX_LIMIT = 50;
    private static final int MIN_LIMIT = 1;
    private static final int TOKEN_REFRESH_SAFETY_SECONDS = 30;
    private static final int DEFAULT_TOKEN_EXPIRY_SECONDS = 3600;
    private static final int SUGGESTION_CANDIDATE_LIMIT = 3;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SearchSuggestService suggestService;
    private final MusicQueryNormalizationService queryNormalizer;

    @Value("${spotify.client-id:}")
    private String clientId;

    @Value("${spotify.client-secret:}")
    private String clientSecret;

    private volatile String cachedAccessToken;
    private volatile LocalDateTime tokenExpiresAt;

    public List<SpotifyTrack> search(String query, int limit) {
        if (isInvalidQuery(query)) return List.of();
        if (isCredentialsMissing()) {
            log.warn("[Spotify] client credentials 미설정 → 검색 스킵");
            return List.of();
        }

        String token = ensureAccessToken();
        if (token == null) return List.of();

        return containsHangul(query)
                ? searchKoreanWithFallback(token, query, limit)
                : callSearch(token, query, limit, null);
    }

    /**
     * 한국어 검색 5단계 폴백.
     *
     * <ol>
     *   <li>KR 마켓 직접 검색
     *   <li>AI 가 영문 정규 표기로 변환 후 글로벌 검색 (예: "뉴진스" → "NewJeans")
     *   <li>YouTube Suggest 가 추천한 정확 표기로 글로벌 검색
     *   <li>원본 한국어로 글로벌 검색
     *   <li>위 결과들을 우선순위대로 합쳐 반환
     * </ol>
     */
    private List<SpotifyTrack> searchKoreanWithFallback(String token, String query, int limit) {
        List<SpotifyTrack> krResults = callSearch(token, query, limit, KOREA_MARKET);
        if (isStrongMatch(krResults, query)) return krResults;

        List<SpotifyTrack> aiResults = searchViaAiNormalization(token, query, limit);
        if (isStrongMatch(aiResults, query)) return aiResults;

        List<SpotifyTrack> suggestedResults = searchViaSuggestion(token, query, limit);
        if (isStrongMatch(suggestedResults, query)) return suggestedResults;

        List<SpotifyTrack> globalResults = callSearch(token, query, limit, null);

        return mergeResultsWithPriority(
                limit, aiResults, suggestedResults, krResults, globalResults);
    }

    private List<SpotifyTrack> searchViaAiNormalization(String token, String query, int limit) {
        String normalized = queryNormalizer.normalize(query);
        if (normalized.equalsIgnoreCase(query)) return List.of();
        return callSearch(token, normalized, limit, null);
    }

    /**
     * YouTube Suggest 가 추천한 정확 표기 (예: "뉴진스" → "NewJeans Super Shy") 로 Spotify 를 재검색해 한국어 매칭이 약한 곡을
     * 보강한다.
     */
    private List<SpotifyTrack> searchViaSuggestion(String token, String query, int limit) {
        try {
            List<String> suggestions = suggestService.suggest(query, SUGGESTION_CANDIDATE_LIMIT);
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

    @SafeVarargs
    private List<SpotifyTrack> mergeResultsWithPriority(
            int limit, List<SpotifyTrack>... resultGroups) {
        Set<String> seenSpotifyIds = new HashSet<>();
        List<SpotifyTrack> merged = new ArrayList<>();

        for (List<SpotifyTrack> group : resultGroups) {
            for (SpotifyTrack track : group) {
                if (track.getSpotifyId() == null) continue;
                if (!seenSpotifyIds.add(track.getSpotifyId())) continue;
                merged.add(track);
                if (merged.size() >= limit) return merged;
            }
        }
        return merged;
    }

    /**
     * 결과가 검색어와 충분히 관련 있는지 판정. 적어도 한 곡의 trackName 또는 artistName 에 검색어가 포함되어야 한다. 띄어쓰기 차이는 무시
     * (compact 비교).
     */
    private boolean isStrongMatch(List<SpotifyTrack> results, String query) {
        if (results == null || results.isEmpty()) return false;

        String normalizedQuery = query.toLowerCase().trim();
        String compactQuery = normalizedQuery.replaceAll("\\s+", "");
        if (compactQuery.isEmpty()) return false;

        for (SpotifyTrack track : results) {
            if (matchesTrackOrArtist(track, normalizedQuery, compactQuery)) return true;
        }
        return false;
    }

    private boolean matchesTrackOrArtist(SpotifyTrack track, String query, String compactQuery) {
        String name = safeLower(track.getTrackName());
        String artist = safeLower(track.getArtistName());
        String compactName = name.replaceAll("\\s+", "");
        String compactArtist = artist.replaceAll("\\s+", "");

        return name.contains(query)
                || artist.contains(query)
                || compactName.contains(compactQuery)
                || compactArtist.contains(compactQuery);
    }

    /** Spotify Search API 단일 호출. market 이 null 이면 글로벌 검색. */
    private List<SpotifyTrack> callSearch(String token, String query, int limit, String market) {
        String url = buildSearchUrl(query, limit, market);
        HttpEntity<Void> request = new HttpEntity<>(buildAuthHeaders(token));

        try {
            String body =
                    restTemplate.exchange(url, HttpMethod.GET, request, String.class).getBody();
            JsonNode trackItems = objectMapper.readTree(body).path("tracks").path("items");

            List<SpotifyTrack> result = new ArrayList<>();
            for (JsonNode item : trackItems) result.add(parseTrack(item));
            return result;
        } catch (Exception e) {
            log.warn("[Spotify] 검색 실패 (market={}): {} → {}", market, query, e.toString());
            return List.of();
        }
    }

    private String buildSearchUrl(String query, int limit, String market) {
        StringBuilder url =
                new StringBuilder(SEARCH_URL)
                        .append("?q=")
                        .append(URLEncoder.encode(query.trim(), StandardCharsets.UTF_8))
                        .append("&type=track")
                        .append("&limit=")
                        .append(clamp(limit, MIN_LIMIT, MAX_LIMIT));
        if (market != null) url.append("&market=").append(market);
        return url.toString();
    }

    private HttpHeaders buildAuthHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return headers;
    }

    /** 토큰이 만료 직전이면 새로 발급, 아니면 캐시된 거 반환. */
    private synchronized String ensureAccessToken() {
        if (isCachedTokenValid()) return cachedAccessToken;

        try {
            JsonNode response = requestNewAccessToken();
            cachedAccessToken = response.path("access_token").asText();
            int expiresIn = response.path("expires_in").asInt(DEFAULT_TOKEN_EXPIRY_SECONDS);
            tokenExpiresAt = LocalDateTime.now().plusSeconds(expiresIn);
            return cachedAccessToken;
        } catch (Exception e) {
            log.error("[Spotify] 토큰 발급 실패 → {}", e.toString());
            return null;
        }
    }

    private boolean isCachedTokenValid() {
        return cachedAccessToken != null
                && tokenExpiresAt != null
                && tokenExpiresAt.isAfter(
                        LocalDateTime.now().plusSeconds(TOKEN_REFRESH_SAFETY_SECONDS));
    }

    private JsonNode requestNewAccessToken() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + encodeBasicCredentials());
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");

        String responseBody =
                restTemplate
                        .exchange(
                                TOKEN_URL,
                                HttpMethod.POST,
                                new HttpEntity<>(body, headers),
                                String.class)
                        .getBody();
        return objectMapper.readTree(responseBody);
    }

    private String encodeBasicCredentials() {
        String credentials = clientId + ":" + clientSecret;
        return Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private SpotifyTrack parseTrack(JsonNode item) {
        JsonNode album = item.path("album");
        ArtworkUrls artwork = parseArtwork(album.path("images"));
        String artistNames = parseArtistNames(item.path("artists"));

        return SpotifyTrack.builder()
                .spotifyId(item.path("id").asText(""))
                .trackName(item.path("name").asText(""))
                .artistName(artistNames)
                .albumName(album.path("name").asText(""))
                .artworkUrl(artwork.thumbnail())
                .artworkUrlHires(artwork.highResolution())
                .previewUrl(parsePreviewUrl(item.path("preview_url")))
                .durationMs(item.path("duration_ms").asInt(0))
                .build();
    }

    /**
     * Spotify 응답의 images 배열은 큰 사이즈에서 작은 사이즈 순서. 0번이 보통 640x640 (hires), 1번이 300x300 (thumbnail).
     */
    private ArtworkUrls parseArtwork(JsonNode images) {
        String hires = images.size() > 0 ? images.get(0).path("url").asText("") : "";
        String thumb = images.size() > 1 ? images.get(1).path("url").asText(hires) : hires;
        return new ArtworkUrls(thumb, hires);
    }

    private String parseArtistNames(JsonNode artists) {
        StringBuilder names = new StringBuilder();
        for (JsonNode artist : artists) {
            if (names.length() > 0) names.append(", ");
            names.append(artist.path("name").asText(""));
        }
        return names.toString();
    }

    private String parsePreviewUrl(JsonNode previewUrlNode) {
        return previewUrlNode.isNull() ? null : previewUrlNode.asText(null);
    }

    /* ----------- 단순 헬퍼들 ----------- */

    private boolean isInvalidQuery(String query) {
        return query == null || query.trim().length() < MIN_QUERY_LENGTH;
    }

    private boolean isCredentialsMissing() {
        return clientId == null
                || clientId.isBlank()
                || clientSecret == null
                || clientSecret.isBlank();
    }

    private boolean containsHangul(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (isHangulCodePoint(c)) return true;
        }
        return false;
    }

    private boolean isHangulCodePoint(char c) {
        return (c >= 0xAC00 && c <= 0xD7A3) // 가-힣
                || (c >= 0x1100 && c <= 0x11FF) // 한글 자모
                || (c >= 0x3130 && c <= 0x318F); // 호환 자모
    }

    private String safeLower(String s) {
        return s == null ? "" : s.toLowerCase();
    }

    private int clamp(int value, int min, int max) {
        return Math.min(Math.max(value, min), max);
    }

    /* ----------- 내부 데이터 클래스 ----------- */

    private record ArtworkUrls(String thumbnail, String highResolution) {}

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
