package com.example.popspotbackend.service.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Locale;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * YouTube Data API v3 — 영상 ID 검색.
 *
 * <p>두 가지 검색 경로:
 *
 * <ul>
 *   <li>{@link #searchOfficialAudio} — Spotify 메타데이터로 곡 ID 매칭 (주 경로)
 *   <li>{@link #searchMusicOnly} — Spotify 가 못 찾는 한국 인디 곡용 폴백
 * </ul>
 *
 * <p>quota 비용: search.list = 100 unit/회. 일일 10,000 unit 무료. 403(quotaExceeded) 응답을 받으면 12시간 동안 호출을
 * 자동 차단해 로그 폭격을 막는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YouTubeMusicSearchService {

    private static final String SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
    private static final int SEARCH_RESULT_LIMIT = 10;
    private static final int QUOTA_BLOCK_HOURS = 12;
    private static final String MUSIC_CATEGORY_ID = "10";
    private static final String FALLBACK_QUERY_SUFFIX = " 노래";

    /**
     * v2.14 / v2.21-S9 — 제목에 포함되면 공식 음원이 아닌 것으로 간주해 매칭에서 제외하는 키워드.
     *
     * <p>v2.14 도입. v2.21-S9 에서 사용자 보고 ("피아노 / 오르골 / nightcore 같은 비공식 변형이 가끔 나옴") 받아 단독 악기 / 템포 변형 /
     * 자장가 / 가이드 보컬 등 30개 키워드 대량 추가.
     *
     * <p>주의: "라이브" / "live" 같은 broad 키워드가 정상 발매곡 ("Live in London (Official)") 까지 차단할 위험은 v2.14 당시
     * 시점에 받아들임. 정확도 우선 정책.
     */
    private static final String[] NON_OFFICIAL_KEYWORDS = {
        // v2.14 — cover / live / remix / acoustic 계열
        "cover",
        "covered",
        "커버",
        "라이브",
        "live",
        "live ver",
        "라이브버전",
        "remix",
        "리믹스",
        "mashup",
        "매쉬업",
        "acoustic",
        "어쿠스틱",
        "unplugged",
        "버스킹",
        "busking",
        "karaoke",
        "노래방",
        "mr",
        "instrumental",
        "inst.",
        "(inst)",
        "reaction",
        "리액션",
        "어쿠스틱버전",
        "ost ver",
        "piano ver",
        "guitar ver",
        "안무",
        "dance practice",
        "쇼케이스",
        "showcase",
        "fancam",
        "직캠",
        // v2.21-S9 — 단독 악기 변형 ("Super Shy piano" 같은 케이스)
        "piano",
        "피아노",
        "guitar",
        "기타 ver",
        "violin",
        "바이올린",
        "orchestra",
        "오케스트라",
        "string ver",
        "string quartet",
        "harp",
        "하프",
        "오르골",
        "music box",
        // v2.21-S9 — 템포 / 음향 변형
        "slowed",
        "sped up",
        "speedup",
        "nightcore",
        "8d",
        "8d audio",
        "reverb",
        "lofi",
        "lo-fi",
        // v2.21-S9 — 자장가 / 가이드 / 짧은 클립
        "lullaby",
        "자장가",
        "guide vocal",
        "가이드 보컬",
        "snippet",
        "clip",
        "preview",
        "teaser",
        "tiktok ver",
        "틱톡",
        "shorts",
        // v2.21-S9 — 차이콥스키 / 클래식 편곡 변형
        "arrangement",
        "편곡",
        "tutorial",
        "튜토리얼",
        "playthrough",
        "연주 영상"
    };

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${youtube.api-key:}")
    private String apiKey;

    /** quota 초과 감지 시 호출을 차단하는 만료 시각. 서버 메모리에만 유지되며 백엔드 재시작 시 초기화된다. */
    private volatile LocalDateTime quotaExhaustedUntil;

    /**
     * 곡의 공식 영상을 검색해 IFrame Player 에 띄울 video ID 를 찾는다.
     *
     * <p>영상 제목으로 5단계 신뢰도 검증을 거쳐 엉뚱한 영상이 박히는 사고를 막는다. 신뢰할 만한 매칭이 없으면 {@code null} 반환.
     */
    public YouTubeVideo searchOfficialAudio(String artist, String track) {
        if (isApiKeyMissing()) {
            log.warn("[YouTube] API 키 미설정 → 검색 스킵");
            return null;
        }
        if (isQuotaCurrentlyBlocked()) return null;

        String query = buildArtistTrackQuery(artist, track);
        String url = buildSearchUrl(query, false);

        try {
            JsonNode items = fetchSearchItems(url);
            if (items.isEmpty()) return null;

            JsonNode best = pickBestByTitle(items, artist, track);
            if (best == null) {
                log.warn("[YouTube] 신뢰할 매칭을 못 찾음 — artist='{}' track='{}'", artist, track);
                return null;
            }
            return toYouTubeVideo(best, artist);
        } catch (HttpClientErrorException.Forbidden e) {
            blockOnQuotaExceeded();
            return null;
        } catch (Exception e) {
            log.warn("[YouTube] 검색 실패: {} → {}", query, e.toString());
            return null;
        }
    }

    /**
     * Spotify 가 못 찾는 한국 인디 곡용 폴백.
     *
     * <p>일반 검색과 다른 점:
     *
     * <ul>
     *   <li>{@code videoCategoryId=10} 강제 → 정치/뉴스/일반 영상 차단
     *   <li>검색어에 "노래" 추가 → 음악 의도 명확화
     *   <li>채널/제목에 음악성 키워드 포함된 영상만 채택
     * </ul>
     */
    public YouTubeVideo searchMusicOnly(String query) {
        if (isApiKeyMissing() || query == null || query.isBlank()) return null;
        if (isQuotaCurrentlyBlocked()) return null;

        String enhancedQuery = query.trim() + FALLBACK_QUERY_SUFFIX;
        String url = buildSearchUrl(enhancedQuery, true);

        try {
            JsonNode items = fetchSearchItems(url);
            if (items.isEmpty()) return null;

            JsonNode picked = pickMusicalCandidate(items);
            if (picked == null) return null;

            return toYouTubeVideo(picked, "");
        } catch (HttpClientErrorException.Forbidden e) {
            blockOnQuotaExceeded();
            return null;
        } catch (Exception e) {
            log.warn("[YouTube] 음악 폴백 실패: {} → {}", query, e.toString());
            return null;
        }
    }

    /* =========================== HTTP / URL =========================== */

    private String buildArtistTrackQuery(String artist, String track) {
        String safeTrack = (track == null) ? "" : track.trim();
        return (artist.trim() + " " + safeTrack).trim();
    }

    /**
     * {@code build().toUri()} 는 한글을 percent-encode 하지 않아 그대로 보내면 400 발생. {@code encode()} 로 명시적으로
     * 인코딩한 String 으로 호출.
     *
     * <p>{@code videoEmbeddable=true} 는 IFrame 재생을 위해 필수. 음악-only 폴백 모드에서는 {@code
     * videoCategoryId=10} 으로 음악 카테고리 강제.
     */
    private String buildSearchUrl(String query, boolean forceMusicCategory) {
        UriComponentsBuilder builder =
                UriComponentsBuilder.fromUriString(SEARCH_URL)
                        .queryParam("part", "snippet")
                        .queryParam("type", "video")
                        .queryParam("videoEmbeddable", "true")
                        .queryParam("maxResults", SEARCH_RESULT_LIMIT)
                        .queryParam("q", query)
                        .queryParam("key", apiKey);

        if (forceMusicCategory) {
            builder.queryParam("videoCategoryId", MUSIC_CATEGORY_ID);
        }
        return builder.encode(StandardCharsets.UTF_8).toUriString();
    }

    private JsonNode fetchSearchItems(String url) throws Exception {
        String response = restTemplate.getForObject(url, String.class);
        return objectMapper.readTree(response).path("items");
    }

    private YouTubeVideo toYouTubeVideo(JsonNode item, String artist) {
        JsonNode snippet = item.path("snippet");
        String channel = snippet.path("channelTitle").asText("");
        return YouTubeVideo.builder()
                .videoId(item.path("id").path("videoId").asText())
                .title(snippet.path("title").asText())
                .channelTitle(channel)
                .thumbnail(snippet.path("thumbnails").path("high").path("url").asText())
                .isOfficial(isOfficialChannel(channel, artist))
                .build();
    }

    /* =========================== Quota 차단 =========================== */

    private boolean isApiKeyMissing() {
        return apiKey == null || apiKey.isBlank();
    }

    private boolean isQuotaCurrentlyBlocked() {
        return quotaExhaustedUntil != null && quotaExhaustedUntil.isAfter(LocalDateTime.now());
    }

    private void blockOnQuotaExceeded() {
        quotaExhaustedUntil = LocalDateTime.now().plusHours(QUOTA_BLOCK_HOURS);
        log.warn("[YouTube] quota 초과 감지 → {} 까지 호출 차단", quotaExhaustedUntil);
    }

    /* =========================== 영상 선택 알고리즘 =========================== */

    /**
     * 5단계 신뢰도 검증을 거쳐 최적 영상 선택. 모든 단계에 v2.14 부터 비공식 키워드 (cover / live / remix / 커버 / 라이브 등) 사전 필터를
     * 적용해 공식 음원만 통과시킨다.
     *
     * <ol>
     *   <li>제목에 아티스트 AND 트랙명 둘 다 포함 (가장 강력)
     *   <li>공식 채널 + 제목에 트랙명 포함
     *   <li>공식 채널(Topic/VEVO/Official)만
     *   <li>제목에 트랙명 포함
     *   <li>제목에 아티스트명 포함 — 가장 마지막 보루
     * </ol>
     *
     * 어느 단계도 통과 못 하면 null — 엉뚱한 영상 박힘 방지.
     */
    private JsonNode pickBestByTitle(JsonNode items, String artist, String track) {
        boolean hasArtist = isNotBlank(artist);
        boolean hasTrack = isNotBlank(track);
        if (!hasArtist && !hasTrack) return items.get(0);

        if (hasArtist && hasTrack) {
            JsonNode strict =
                    findFirstMatching(
                            items,
                            item ->
                                    !isNonOfficialVariant(item)
                                            && isArtistAndTrackInTitle(item, artist, track));
            if (strict != null) return strict;
        }
        if (hasTrack) {
            JsonNode officialWithTrack =
                    findFirstMatching(
                            items,
                            item ->
                                    !isNonOfficialVariant(item)
                                            && isOfficialWithTrack(item, artist, track));
            if (officialWithTrack != null) return officialWithTrack;
        }

        JsonNode officialOnly =
                findFirstMatching(
                        items, item -> !isNonOfficialVariant(item) && isOfficialItem(item, artist));
        if (officialOnly != null) return officialOnly;

        if (hasTrack) {
            JsonNode trackInTitle =
                    findFirstMatching(
                            items, item -> !isNonOfficialVariant(item) && isInTitle(item, track));
            if (trackInTitle != null) return trackInTitle;
        }
        if (hasArtist) {
            return findFirstMatching(
                    items, item -> !isNonOfficialVariant(item) && isInTitle(item, artist));
        }
        return null;
    }

    /**
     * 제목에 비공식 변형 키워드 (cover / live / remix / 라이브 / 커버 ...) 가 들어 있으면 true.
     *
     * <p>v2.14 — 공식 음원이 아닌 영상을 사전에 모든 매칭 단계에서 차단한다. 정확도가 살짝 떨어지더라도 사용자가 "공식이 아닌 cover 가 나온다" 고 느끼는
     * 것보다 검색 미스가 낫다는 정책 결정.
     */
    private boolean isNonOfficialVariant(JsonNode item) {
        String title = item.path("snippet").path("title").asText("");
        if (title.isEmpty()) return false;
        String lower = title.toLowerCase(Locale.ROOT);
        for (String keyword : NON_OFFICIAL_KEYWORDS) {
            if (lower.contains(keyword)) return true;
        }
        return false;
    }

    /** 음악-only 폴백 — 채널/제목에 음악성 키워드 포함된 첫 후보 반환. v2.14 부터 cover/live 등 비공식 변형은 사전 제외. */
    private JsonNode pickMusicalCandidate(JsonNode items) {
        return findFirstMatching(
                items, item -> !isNonOfficialVariant(item) && hasMusicalSignal(item));
    }

    private boolean hasMusicalSignal(JsonNode item) {
        String channel = item.path("snippet").path("channelTitle").asText("");
        String title = item.path("snippet").path("title").asText("");
        return hasMusicalChannelKeyword(channel) || hasMusicalTitleKeyword(title);
    }

    private boolean hasMusicalChannelKeyword(String channel) {
        String upper = channel.toUpperCase(Locale.ROOT);
        return upper.endsWith("- TOPIC")
                || upper.contains("VEVO")
                || upper.contains("OFFICIAL")
                || upper.contains("RECORDS")
                || upper.contains("ENTERTAINMENT");
    }

    private boolean hasMusicalTitleKeyword(String title) {
        String upper = title.toUpperCase(Locale.ROOT);
        return upper.contains("MV")
                || upper.contains("M/V")
                || upper.contains("AUDIO")
                || upper.contains("OFFICIAL")
                || title.contains("뮤직비디오")
                || title.contains("음원")
                || title.contains("노래");
    }

    /* =========================== 매칭 조건 =========================== */

    private boolean isArtistAndTrackInTitle(JsonNode item, String artist, String track) {
        String title = item.path("snippet").path("title").asText("");
        return containsLoose(title, artist) && containsLoose(title, track);
    }

    private boolean isOfficialWithTrack(JsonNode item, String artist, String track) {
        String channel = item.path("snippet").path("channelTitle").asText("");
        String title = item.path("snippet").path("title").asText("");
        return isOfficialChannel(channel, artist) && containsLoose(title, track);
    }

    private boolean isOfficialItem(JsonNode item, String artist) {
        String channel = item.path("snippet").path("channelTitle").asText("");
        return isOfficialChannel(channel, artist);
    }

    private boolean isInTitle(JsonNode item, String needle) {
        String title = item.path("snippet").path("title").asText("");
        return containsLoose(title, needle);
    }

    private boolean isOfficialChannel(String channel, String artist) {
        if (channel == null) return false;
        String upper = channel.toUpperCase(Locale.ROOT);
        return upper.endsWith("- TOPIC")
                || upper.contains("VEVO")
                || upper.contains("OFFICIAL")
                || channel.equalsIgnoreCase(artist);
    }

    /* =========================== 단순 헬퍼 =========================== */

    @FunctionalInterface
    private interface ItemPredicate {
        boolean test(JsonNode item);
    }

    private JsonNode findFirstMatching(JsonNode items, ItemPredicate predicate) {
        for (JsonNode item : items) {
            if (predicate.test(item)) return item;
        }
        return null;
    }

    /** 대소문자 / 공백 / 특수문자 무시한 부분 일치 비교. "Super Shy" 가 "NewJeans 'Super Shy' (MV)" 안에 있는지 같이 인식. */
    private boolean containsLoose(String haystack, String needle) {
        if (haystack == null || needle == null) return false;
        String h = normalize(haystack);
        String n = normalize(needle);
        return !n.isEmpty() && h.contains(n);
    }

    private String normalize(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("[\\s'\\\"`()\\[\\].,!?·\\-_/]", "");
    }

    private boolean isNotBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    /* =========================== 공개 DTO =========================== */

    @Builder
    @Getter
    public static class YouTubeVideo {
        private String videoId;
        private String title;
        private String channelTitle;
        private String thumbnail;
        private Boolean isOfficial;
    }
}
