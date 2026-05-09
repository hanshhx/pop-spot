package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * 검색어 자동완성 — YouTube Suggest 엔드포인트를 백엔드 프록시로 호출.
 *
 * - 무료, API 키 불필요
 * - 한국 곡 데이터 풍부 (유튜브 검색 트렌드 기반)
 * - 응답이 JSON: ["query", ["후보1", "후보2", ...], ...]
 *
 * CORS 우회를 위해 프론트엔드는 자체 백엔드만 호출하고
 * 여기서 Suggest 로 프록시한다 (브라우저 직접 호출 시 CORS 차단됨).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchSuggestService {

    // ⚠️ oe=utf-8 / ie=utf-8 강제 — 이거 없으면 한국어 응답이 EUC-KR 류 인코딩으로 와서
    //    UTF-8 디코딩 시 글자 깨지고 JSON 파싱 실패한다.
    private static final String SUGGEST_URL =
            "https://suggestqueries.google.com/complete/search?ds=yt&client=firefox&hl=ko&oe=utf-8&ie=utf-8&q=";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    /** 같은 쿼리에 대해 반복 호출하지 않도록 메모리 캐시 */
    private final ConcurrentMap<String, List<String>> cache = new ConcurrentHashMap<>();

    public List<String> suggest(String query, int limit) {
        if (query == null || query.trim().isEmpty()) return List.of();
        String key = query.trim().toLowerCase();

        List<String> cached = cache.get(key);
        // 빈 결과는 캐시 안 함 — 일시적 실패가 영구화되는 걸 방지
        if (cached != null && !cached.isEmpty()) return cap(cached, limit);

        try {
            // ⚠️ String 으로 호출하면 Spring 이 또 인코딩해서 %EB → %25EB 로 이중 인코딩됨.
            //    URI 객체로 명시적으로 만들어 넘기면 추가 인코딩이 일어나지 않는다.
            String encodedQuery = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            URI uri = URI.create(SUGGEST_URL + encodedQuery);
            log.debug("[자동완성] 호출 시작: q={}", query);

            // ⚠️ Spring RestTemplate 의 String 변환은 응답 Content-Type 에 charset 이 없으면
            //    ISO-8859-1 로 디코딩해서 한글이 깨진다. byte[] 로 받아서 명시적으로 UTF-8 변환.
            byte[] raw = restTemplate.getForObject(uri, byte[].class);
            if (raw == null || raw.length == 0) {
                log.warn("[자동완성] 빈 응답: {}", query);
                return List.of();
            }
            String response = new String(raw, StandardCharsets.UTF_8);

            JsonNode root = mapper.readTree(response);
            // 응답 구조: ["query", ["candidate1", "candidate2", ...], ...]
            JsonNode list = root.size() > 1 ? root.get(1) : null;
            if (list == null || !list.isArray()) {
                log.warn("[자동완성] 응답 구조 이상: {} → {}", query,
                        response.substring(0, Math.min(200, response.length())));
                return List.of();
            }

            List<String> result = new ArrayList<>();
            for (JsonNode item : list) {
                String text = item.asText("").trim();
                if (!text.isEmpty()) result.add(text);
            }

            // 음악 관련 키워드가 들어간 후보를 위로 (선택적 가산점)
            result = preferMusical(result, query.trim());

            // 결과가 있을 때만 캐시
            if (!result.isEmpty()) cache.put(key, result);
            return cap(result, limit);
        } catch (Exception e) {
            log.warn("[자동완성] 실패: {} → {}", query, e.toString());
            return List.of();
        }
    }

    /**
     * 음악성 있는 후보를 위쪽으로 정렬 (가수, 곡, 앨범, 노래, MV 같은 단어).
     * 안정 정렬이라 같은 점수면 원래 순서 유지.
     */
    private List<String> preferMusical(List<String> items, String original) {
        return items.stream()
                .sorted((a, b) -> Integer.compare(score(b), score(a)))
                .toList();
    }

    private int score(String text) {
        String lower = text.toLowerCase();
        int s = 0;
        if (lower.contains("노래") || lower.contains("곡")) s += 5;
        if (lower.contains("가사")) s += 3;
        if (lower.contains("mv") || lower.contains("m/v")) s += 4;
        if (lower.contains("audio") || lower.contains("official")) s += 4;
        if (lower.contains("앨범") || lower.contains("album")) s += 2;
        return s;
    }

    private List<String> cap(List<String> items, int limit) {
        if (items.size() <= limit) return items;
        return items.subList(0, limit);
    }
}
