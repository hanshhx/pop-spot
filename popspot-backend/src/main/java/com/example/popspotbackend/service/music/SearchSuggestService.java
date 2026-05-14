package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 검색어 자동완성 — YouTube Suggest 엔드포인트를 백엔드 프록시로 호출한다.
 *
 * <p>무료 + API 키 불필요 + 한국 곡 데이터 풍부.
 *
 * <p>브라우저에서 직접 호출하면 CORS 가 막혀서 백엔드 프록시 형태로 제공한다. 응답은 JSON 배열 형식: {@code ["query", ["candidate1",
 * "candidate2", ...], ...]}
 *
 * <p>같은 검색어에 대한 결과는 메모리 캐시되어 반복 호출이 외부로 나가지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchSuggestService {

    /**
     * YouTube Suggest 의 한국어 응답은 명시적으로 UTF-8 강제하지 않으면 EUC-KR 류 인코딩으로 와서 디코딩 후 글자가 깨진다. {@code
     * oe=utf-8} / {@code ie=utf-8} 가 인코딩 호환성을 보장한다.
     */
    private static final String SUGGEST_URL_PREFIX =
            "https://suggestqueries.google.com/complete/search"
                    + "?ds=yt&client=firefox&hl=ko&oe=utf-8&ie=utf-8&q=";

    private static final int RESPONSE_LOG_PREVIEW_LENGTH = 200;

    private static final int SCORE_KOREAN_SONG_KEYWORD = 5;
    private static final int SCORE_LYRICS_KEYWORD = 3;
    private static final int SCORE_MV_KEYWORD = 4;
    private static final int SCORE_OFFICIAL_AUDIO_KEYWORD = 4;
    private static final int SCORE_ALBUM_KEYWORD = 2;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConcurrentMap<String, List<String>> suggestionCache = new ConcurrentHashMap<>();

    public List<String> suggest(String query, int limit) {
        if (isInvalidQuery(query)) return List.of();

        String cacheKey = query.trim().toLowerCase();
        List<String> cached = suggestionCache.get(cacheKey);
        if (cached != null && !cached.isEmpty()) {
            return capToLimit(cached, limit);
        }

        try {
            List<String> suggestions = fetchSuggestionsFromYouTube(query);
            List<String> sorted = sortByMusicalRelevance(suggestions);

            if (!sorted.isEmpty()) {
                suggestionCache.put(cacheKey, sorted);
            }
            return capToLimit(sorted, limit);
        } catch (Exception e) {
            log.warn("[자동완성] 실패: {} → {}", query, e.toString());
            return List.of();
        }
    }

    /**
     * Spring 의 String URL 호출은 percent-encoded 값을 또 인코딩하므로 (예: {@code %EB} → {@code %25EB}) URI 객체로
     * 명시적으로 넘긴다.
     */
    private List<String> fetchSuggestionsFromYouTube(String query) throws Exception {
        String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
        URI uri = URI.create(SUGGEST_URL_PREFIX + encoded);
        log.debug("[자동완성] 호출 시작: q={}", query);

        byte[] rawBytes = restTemplate.getForObject(uri, byte[].class);
        if (rawBytes == null || rawBytes.length == 0) {
            log.warn("[자동완성] 빈 응답: {}", query);
            return List.of();
        }

        String responseBody = decodeAsUtf8(rawBytes);
        JsonNode candidatesNode = parseCandidatesArray(responseBody, query);
        return extractTextValues(candidatesNode);
    }

    /**
     * RestTemplate 의 String 변환은 Content-Type 에 charset 이 없으면 ISO-8859-1 로 디코딩한다. byte[] 로 받아 명시적으로
     * UTF-8 변환해야 한글이 깨지지 않는다.
     */
    private String decodeAsUtf8(byte[] rawBytes) {
        return new String(rawBytes, StandardCharsets.UTF_8);
    }

    /** 응답 구조: {@code ["query", ["candidate1", ...], ...]} 의 1번 인덱스. */
    private JsonNode parseCandidatesArray(String responseBody, String query) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode candidates = root.size() > 1 ? root.get(1) : null;

        if (candidates == null || !candidates.isArray()) {
            String preview =
                    responseBody.substring(
                            0, Math.min(RESPONSE_LOG_PREVIEW_LENGTH, responseBody.length()));
            log.warn("[자동완성] 응답 구조 이상: {} → {}", query, preview);
            return objectMapper.createArrayNode();
        }
        return candidates;
    }

    private List<String> extractTextValues(JsonNode arrayNode) {
        List<String> texts = new ArrayList<>();
        for (JsonNode item : arrayNode) {
            String text = item.asText("").trim();
            if (!text.isEmpty()) texts.add(text);
        }
        return texts;
    }

    /** 음악성 키워드(MV/곡/노래/Audio 등)가 포함된 후보를 위로. 안정 정렬이라 같은 점수면 원래 순서가 유지된다. */
    private List<String> sortByMusicalRelevance(List<String> items) {
        return items.stream()
                .sorted(Comparator.comparingInt(this::calculateMusicalScore).reversed())
                .toList();
    }

    private int calculateMusicalScore(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        int score = 0;
        if (lower.contains("노래") || lower.contains("곡")) score += SCORE_KOREAN_SONG_KEYWORD;
        if (lower.contains("가사")) score += SCORE_LYRICS_KEYWORD;
        if (lower.contains("mv") || lower.contains("m/v")) score += SCORE_MV_KEYWORD;
        if (lower.contains("audio") || lower.contains("official"))
            score += SCORE_OFFICIAL_AUDIO_KEYWORD;
        if (lower.contains("앨범") || lower.contains("album")) score += SCORE_ALBUM_KEYWORD;
        return score;
    }

    private boolean isInvalidQuery(String query) {
        return query == null || query.trim().isEmpty();
    }

    private List<String> capToLimit(List<String> items, int limit) {
        if (items.size() <= limit) return items;
        return items.subList(0, limit);
    }
}
