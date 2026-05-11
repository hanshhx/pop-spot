package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

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

        // 단순 "아티스트 + 곡명" 으로 검색 — "official audio" 같은 영문 키워드는
        // 한국 곡에서 오히려 매칭률을 떨어뜨림 (DAY6 한국곡 검색 시 영어 단어 들어가면 노이즈).
        String query = (artist.trim() + " " + (track == null ? "" : track.trim())).trim();

        // ⚠️ build().toUri() 는 한글 인코딩 안 함 → percent-encoding 필수.
        // ⚠️ videoEmbeddable=true 는 IFrame 재생 위해 유지 (없으면 빈 화면).
        // ✗ videoCategoryId=10 (Music) 제거 — 라이브, 직접 업로드, 커버 등 카테고리 분류 안 된 영상까지 포함해서 매칭률 ↑
        // ✗ videoSyndicated=true 제거 — 너무 엄격해서 후보 0개 되는 경우 많음
        String uri = UriComponentsBuilder
                .fromUriString("https://www.googleapis.com/youtube/v3/search")
                .queryParam("part", "snippet")
                .queryParam("type", "video")
                .queryParam("videoEmbeddable", "true")
                .queryParam("maxResults", 10)
                .queryParam("q", query)
                .queryParam("key", apiKey)
                .encode(java.nio.charset.StandardCharsets.UTF_8)
                .toUriString();

        // quota 초과 상태면 호출 자체를 일정 시간 스킵 (서버 메모리 캐시)
        if (quotaExhaustedUntil != null && quotaExhaustedUntil.isAfter(java.time.LocalDateTime.now())) {
            return null;
        }

        try {
            String response = restTemplate.getForObject(uri, String.class);
            JsonNode items = mapper.readTree(response).path("items");
            if (items.isEmpty()) return null;

            // 공식 채널 있으면 우선, 없으면 그냥 첫 번째 (= YouTube 가 가장 관련성 높다고 판단한 영상).
            // 이전에는 공식 없으면 null 리턴해서 곡이 안 떴는데, 이제는 무조건 후보를 사용.
            JsonNode best = pickPreferredOrFirst(items, artist);

            return YouTubeVideo.builder()
                    .videoId(best.path("id").path("videoId").asText())
                    .title(best.path("snippet").path("title").asText())
                    .channelTitle(best.path("snippet").path("channelTitle").asText())
                    .thumbnail(best.path("snippet").path("thumbnails").path("high").path("url").asText())
                    .isOfficial(isOfficialChannel(best.path("snippet").path("channelTitle").asText(), artist))
                    .build();
        } catch (org.springframework.web.client.HttpClientErrorException.Forbidden e) {
            // quotaExceeded 등 403 은 일반적으로 일일 quota 초과 → 다음 PT 자정까지 호출 차단.
            // 매 호출마다 로그 폭격되는 걸 막기 위해 12시간 동안 호출 자체 스킵.
            quotaExhaustedUntil = java.time.LocalDateTime.now().plusHours(12);
            log.warn("[YouTube] quota 초과 감지 → {} 까지 호출 차단", quotaExhaustedUntil);
            return null;
        } catch (Exception e) {
            log.warn("[YouTube] 검색 실패: {} → {}", query, e.toString());
            return null;
        }
    }

    /** quota 초과 감지 시 호출을 차단하는 시각 (서버 메모리에만 기록 — 재시작 시 리셋) */
    private volatile java.time.LocalDateTime quotaExhaustedUntil;

    /**
     * 한국 인디 곡 검색용 폴백 — Spotify 매칭이 약할 때 사용.
     *
     * 일반 검색과 달리:
     *   - videoCategoryId=10 (Music) 강제 → 정치/뉴스/일반 영상 차단
     *   - 검색어에 "노래" 키워드 추가해서 음악 의도 명확히
     *   - 결과 영상 제목에 음악성 키워드(MV/Audio/Topic/뮤직 등) 가 있는 것만 채택
     *   - 그래도 못 찾으면 null (엉뚱한 영상은 절대 안 잡힘)
     */
    public YouTubeVideo searchMusicOnly(String query) {
        if (apiKey == null || apiKey.isBlank()) return null;
        if (query == null || query.isBlank()) return null;
        if (quotaExhaustedUntil != null && quotaExhaustedUntil.isAfter(java.time.LocalDateTime.now())) {
            return null;
        }

        // 검색어에 음악 의도 키워드 추가 → "한페이지" 대신 "한페이지 노래" 로 검색
        String enhancedQuery = query.trim() + " 노래";

        String uri = UriComponentsBuilder
                .fromUriString("https://www.googleapis.com/youtube/v3/search")
                .queryParam("part", "snippet")
                .queryParam("type", "video")
                .queryParam("videoCategoryId", "10")     // Music 카테고리 강제
                .queryParam("videoEmbeddable", "true")
                .queryParam("maxResults", 10)
                .queryParam("q", enhancedQuery)
                .queryParam("key", apiKey)
                .encode(java.nio.charset.StandardCharsets.UTF_8)
                .toUriString();

        try {
            String response = restTemplate.getForObject(uri, String.class);
            JsonNode items = mapper.readTree(response).path("items");
            if (items.isEmpty()) return null;

            JsonNode picked = pickMusicalCandidate(items);
            if (picked == null) return null;

            String channel = picked.path("snippet").path("channelTitle").asText("");
            return YouTubeVideo.builder()
                    .videoId(picked.path("id").path("videoId").asText())
                    .title(picked.path("snippet").path("title").asText())
                    .channelTitle(channel)
                    .thumbnail(picked.path("snippet").path("thumbnails").path("high").path("url").asText())
                    .isOfficial(isOfficialChannel(channel, ""))
                    .build();
        } catch (org.springframework.web.client.HttpClientErrorException.Forbidden e) {
            quotaExhaustedUntil = java.time.LocalDateTime.now().plusHours(12);
            log.warn("[YouTube] quota 초과 (음악 폴백) → {} 까지 차단", quotaExhaustedUntil);
            return null;
        } catch (Exception e) {
            log.warn("[YouTube] 음악 폴백 실패: {} → {}", query, e.toString());
            return null;
        }
    }

    /**
     * 결과 후보 중 명백히 음악성 있는 영상만 추려낸다.
     * 채널이 Topic/VEVO/Official 이거나, 제목에 MV/Audio/노래/뮤직 같은 키워드가 있는 것.
     */
    private JsonNode pickMusicalCandidate(JsonNode items) {
        for (JsonNode item : items) {
            String channel = item.path("snippet").path("channelTitle").asText("");
            String title = item.path("snippet").path("title").asText("");
            String channelUpper = channel.toUpperCase(Locale.ROOT);
            String titleUpper = title.toUpperCase(Locale.ROOT);

            boolean musicalChannel = channelUpper.endsWith("- TOPIC")
                    || channelUpper.contains("VEVO")
                    || channelUpper.contains("OFFICIAL")
                    || channelUpper.contains("RECORDS")
                    || channelUpper.contains("ENTERTAINMENT");

            boolean musicalTitle = titleUpper.contains("MV")
                    || titleUpper.contains("M/V")
                    || titleUpper.contains("AUDIO")
                    || titleUpper.contains("OFFICIAL")
                    || title.contains("뮤직비디오")
                    || title.contains("음원")
                    || title.contains("노래");

            if (musicalChannel || musicalTitle) return item;
        }
        return null;
    }

    /**
     * 공식 채널(Topic/VEVO/Official) 있으면 그것을, 없으면 첫 번째 결과를 반환.
     * 매칭 자체가 우선이라 공식 없다고 null 안 돌려준다.
     */
    private JsonNode pickPreferredOrFirst(JsonNode items, String artist) {
        JsonNode topic = null, vevo = null, official = null;
        for (JsonNode item : items) {
            String channel = item.path("snippet").path("channelTitle").asText("");
            String upper = channel.toUpperCase(Locale.ROOT);
            if (upper.endsWith("- TOPIC") && topic == null) topic = item;
            else if (upper.contains("VEVO") && vevo == null) vevo = item;
            else if ((upper.contains("OFFICIAL") || channel.equalsIgnoreCase(artist)) && official == null) official = item;
        }
        if (topic != null) return topic;
        if (vevo != null) return vevo;
        if (official != null) return official;
        return items.get(0);  // 공식 없으면 그냥 가장 위에 뜬 영상
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
