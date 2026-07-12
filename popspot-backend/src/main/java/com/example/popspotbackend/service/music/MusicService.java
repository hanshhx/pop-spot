package com.example.popspotbackend.service.music;

import com.example.popspotbackend.entity.MusicTrack;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.UserMusicHistory;
import com.example.popspotbackend.repository.MusicTrackRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserMusicHistoryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 음악 → 팝업 매칭의 메인 서비스.
 *
 * <p>전체 흐름:
 *
 * <ol>
 *   <li>Spotify 검색으로 곡 메타데이터 확보
 *   <li>재생 시점에 YouTube 영상 ID 를 lazy fetch (quota 절약)
 *   <li>Groq AI 가 곡의 무드를 5개 키워드로 분석
 *   <li>무드 키워드와 팝업 description/category 의 교집합으로 매칭 점수 산정
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicService {

    private static final int MATCH_RESULT_LIMIT = 5;
    private static final int RECOMMENDATION_CANDIDATE_POOL = 200;
    private static final int REVERSE_MATCH_CANDIDATE_POOL = 500;

    /**
     * v2.21-S7 — YouTube IFrame 재생 실패 누적 임계값. 이 횟수 이상 실패한 트랙은 검색 / 추천 / 역방향 매칭에서 모두 자동 제외된다. 어드민이
     * youtube_video_id 재선택 (cover 청소 엔드포인트) 으로 복구 가능.
     */
    private static final int PLAYBACK_FAILURE_THRESHOLD = 3;

    private static final int FALLBACK_POPUP_SCORE = 50;
    private static final int MAX_MATCH_SCORE = 100;

    private static final int MUSIC_TO_POPUP_TAG_SCORE = 30;
    private static final int POPUP_TO_MUSIC_TAG_SCORE = 25;
    private static final int SIMILARITY_TAG_SCORE = 20;
    private static final int ARTIST_AFFINITY_BONUS = 15;
    private static final int USER_HISTORY_DEPTH = 40;

    private static final String MOOD_DANCE = "댄스";
    private static final String MOOD_KITSCH = "키치";
    private static final String MOOD_CAFE = "카페";
    private static final String CATEGORY_FASHION = "FASHION";
    private static final String CATEGORY_CHARACTER = "CHARACTER";
    private static final String CATEGORY_FOOD = "FOOD";
    private static final int CATEGORY_BONUS_FASHION_DANCE = 10;
    private static final int CATEGORY_BONUS_CHARACTER_KITSCH = 15;
    private static final int CATEGORY_BONUS_FOOD_CAFE = 15;

    private final SpotifySearchService spotify;
    private final YouTubeMusicSearchService youtube;
    private final ITunesPreviewService itunesPreview;
    private final MusicQueryNormalizationService queryNormalization;
    private final MusicMoodAnalysisService moodService;
    private final MusicTrackRepository trackRepo;
    private final UserMusicHistoryRepository historyRepo;
    private final PopupStoreRepository popupRepo;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * v2.14 — 어드민이 cover / 비공식 의심 캐시를 일괄 청소.
     *
     * <p>youtube_channel 에 cover/live/remix 같은 키워드가 있거나 isOfficial=false 로 저장된 row 의
     * youtube_video_id 를 NULL 로 초기화한다. 다음 재생 시 v2.14 새 필터로 다시 매칭되어 공식 음원만 박힌다. YouTube API quota
     * 영향: 사용자가 재생하는 시점에만 호출되므로 즉시 부담 X.
     */
    @Transactional
    public Map<String, Integer> clearLikelyCoverCache() {
        List<MusicTrack> targets = trackRepo.findLikelyNonOfficialCached();
        if (targets.isEmpty()) return Map.of("scanned", 0, "cleared", 0);

        List<Long> ids = targets.stream().map(MusicTrack::getId).toList();
        int updated = trackRepo.clearYoutubeCacheByIds(ids);
        log.info("[Music] cover 캐시 청소 — {} 곡 youtube_video_id 초기화", updated);
        return Map.of("scanned", targets.size(), "cleared", updated);
    }

    /**
     * 검색 그리드용 — Spotify 메타데이터만 조회하고 YouTube 는 lazy fetch. 자동완성이 사용자 의도를 정확한 텍스트로 만들어주므로 백엔드에서 추측
     * 로직을 둘 필요가 없다.
     */
    @Transactional
    public List<MusicTrack> searchTracks(String query, int limit) {
        // v2.21-S16 — 한국어 검색어를 Spotify 매칭 정식 표기로 변환 (데이식스→DAY6, 뉴진스→NewJeans).
        // 이전엔 정규화 서비스가 만들어졌는데 호출 안 되어 영어 제목 곡이 한글 검색에 안 잡혔음.
        String normalizedQuery = queryNormalization.normalize(query);
        List<SpotifySearchService.SpotifyTrack> spotifyResults =
                spotify.search(normalizedQuery, limit);

        List<MusicTrack> result = new ArrayList<>();
        for (SpotifySearchService.SpotifyTrack spotifyTrack : spotifyResults) {
            MusicTrack track =
                    trackRepo
                            .findBySpotifyTrackId(spotifyTrack.getSpotifyId())
                            .orElseGet(() -> upsertTrackMetaOnly(spotifyTrack));
            result.add(track);
        }
        return result;
    }

    /** 곡 1개의 분위기 분석 + 팝업 매칭. 재생 시점에 호출되는 핵심 메서드. */
    @Transactional
    public MatchResult matchPopups(Long trackId, String userId) {
        MusicTrack track = findTrackOrThrow(trackId);

        ensureYoutubeVideoId(track);
        ensurePreviewUrl(track);
        ensureMoodTags(track);
        incrementPlayCount(track);
        trackRepo.save(track);

        List<String> moodTags = parseTagsJson(track.getMoodTags());
        List<PopupMatch> matches = matchByMood(moodTags, MATCH_RESULT_LIMIT);

        recordListeningHistory(userId, track, matches);

        return new MatchResult(track, moodTags, matches);
    }

    /** 운명의 곡 룰렛 — 무드 태그 있는 곡 중 랜덤 1곡 + 그 곡의 매칭 팝업 */
    @Transactional
    public MatchResult roulette(String userId) {
        MusicTrack track =
                trackRepo
                        .findRandomWithMood()
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "아직 운명의 곡 풀이 비어있습니다 — 먼저 곡 검색을 해주세요."));
        return matchPopups(track.getId(), userId);
    }

    /** 인기 트랙 (홈 인기차트용) — 누적 재생 횟수 기준. */
    public List<MusicTrack> popular(int limit) {
        return trackRepo.findTopPlayed(PageRequest.of(0, limit));
    }

    /** 카테고리 키워드로 검색해 그리드 채우기 (예: "여름밤", "운동"). */
    @Transactional
    public List<MusicTrack> tracksForCategory(String keyword, int limit) {
        return searchTracks(keyword, limit);
    }

    /** 하위호환 — 유저 정보 없이 시드 곡 기반 추천. */
    public List<MusicTrack> recommendNext(Long seedTrackId, int limit) {
        return recommendNext(seedTrackId, limit, null);
    }

    /**
     * 자동 다음 곡 추천(개인화).
     *
     * <p>시드 곡 무드 유사도(가중치 2)에 <b>유저 재생 이력</b>의 무드 취향·선호 아티스트를 더해 점수화. 로그인 유저마다
     * 같은 곡에서도 다른 추천이 나온다. 외부 API 안 쓰고 DB 만으로 처리하므로 quota 부담 0.
     */
    public List<MusicTrack> recommendNext(Long seedTrackId, int limit, String userId) {
        MusicTrack seed = trackRepo.findById(seedTrackId).orElse(null);
        if (seed == null) return List.of();

        List<String> seedMoods = parseTagsJson(seed.getMoodTags());
        Taste taste = userTaste(userId);
        if (seedMoods.isEmpty() && taste.moods().isEmpty()) return popular(limit);

        // 시드 자신만 제외 — "다음 곡"은 이미 들은 곡도 다시 나올 수 있음.
        return rankByProfile(seedMoods, taste, seedTrackId, Set.of(), limit);
    }

    /**
     * '당신을 위한' 개인 추천 피드.
     *
     * <p>유저 재생 이력에서 무드 프로필·선호 아티스트를 뽑아, 그 취향에 가까운 곡을 점수화(이미 들은 곡 제외). 이력이 없는
     * 신규/게스트는 인기곡으로 폴백. 무드 키워드 고정으로 쏠리던 문제를 유저별 취향으로 보완한다.
     */
    public List<MusicTrack> forYou(String userId, int limit) {
        Taste taste = userTaste(userId);
        if (taste.moods().isEmpty()) return popular(limit);
        return rankByProfile(taste.moods(), taste, null, taste.playedIds(), limit);
    }

    /** 무드 유사도 + 유저 취향(무드·아티스트) 블렌드로 후보 풀을 정렬. */
    private List<MusicTrack> rankByProfile(
            List<String> seedMoods, Taste taste, Long excludeSeedId, Set<Long> excludeIds, int limit) {
        return trackRepo.findTopPlayed(PageRequest.of(0, RECOMMENDATION_CANDIDATE_POOL)).stream()
                .filter(t -> excludeSeedId == null || !t.getId().equals(excludeSeedId))
                .filter(t -> !excludeIds.contains(t.getId()))
                .filter(this::hasYoutubeVideoId)
                .filter(this::isPlaybackHealthy)
                .map(
                        t -> {
                            List<String> tMoods = parseTagsJson(t.getMoodTags());
                            int score = similarityScore(seedMoods, tMoods) * 2;
                            score += similarityScore(taste.moods(), tMoods);
                            String artist = t.getArtistName();
                            if (artist != null && taste.artists().contains(artist.toLowerCase())) {
                                score += ARTIST_AFFINITY_BONUS;
                            }
                            return new RankedTrack(t, score);
                        })
                .filter(rt -> rt.score() > 0)
                .sorted(Comparator.comparingInt(RankedTrack::score).reversed())
                .limit(limit)
                .map(RankedTrack::track)
                .toList();
    }

    /** 유저 취향 프로필 — 최근 이력에서 무드(빈도순)·선호 아티스트·들은 곡 id 집계. 비로그인/무이력이면 빈 값. */
    private Taste userTaste(String userId) {
        if (userId == null || userId.isBlank()) return Taste.EMPTY;
        List<UserMusicHistory> hist =
                historyRepo.findByUserIdOrderByPlayedAtDesc(
                        userId, PageRequest.of(0, USER_HISTORY_DEPTH));
        if (hist.isEmpty()) return Taste.EMPTY;

        Set<Long> played = new HashSet<>();
        List<Long> ids = new ArrayList<>();
        for (UserMusicHistory h : hist) {
            if (played.add(h.getTrackId())) ids.add(h.getTrackId());
        }
        Map<String, Integer> moodFreq = new HashMap<>();
        Set<String> artists = new HashSet<>();
        for (MusicTrack t : trackRepo.findAllById(ids)) {
            for (String m : parseTagsJson(t.getMoodTags())) moodFreq.merge(m, 1, Integer::sum);
            String a = t.getArtistName();
            if (a != null && !a.isBlank()) artists.add(a.toLowerCase());
        }
        List<String> moods =
                moodFreq.entrySet().stream()
                        .sorted(Comparator.<Map.Entry<String, Integer>>comparingInt(Map.Entry::getValue)
                                .reversed())
                        .map(Map.Entry::getKey)
                        .toList();
        return new Taste(moods, artists, played);
    }

    /** 유저 취향 스냅샷 — 무드(빈도순) · 선호 아티스트(소문자) · 이미 들은 곡 id. */
    private record Taste(List<String> moods, Set<String> artists, Set<Long> playedIds) {
        static final Taste EMPTY = new Taste(List.of(), Set.of(), Set.of());
    }

    /**
     * v2.21-S7 — 프론트 YouTube IFrame onError 호출 시 카운터 1 증가. 누적 임계값 초과 시 isPlaybackHealthy 가 false 가
     * 되어 검색 / 추천 후보에서 자동 제외된다.
     */
    public void recordPlaybackFailure(Long trackId) {
        if (trackId == null) return;
        trackRepo.incrementPlaybackFailed(trackId);
    }

    /** v2.21-S7 — 재생 실패 임계값 미만이면 후보로 인정. null / 0 도 통과. */
    private boolean isPlaybackHealthy(MusicTrack t) {
        Integer count = t.getPlaybackFailedCount();
        return count == null || count < PLAYBACK_FAILURE_THRESHOLD;
    }

    /** 역방향 매칭 — 팝업 ID 로 그 팝업과 분위기가 어울리는 곡 N 개 반환. */
    public List<TrackMatch> matchTracksForPopup(Long popupId, int limit) {
        PopupStore popup = popupRepo.findById(popupId).orElse(null);
        if (popup == null) return List.of();

        String popupHaystack = buildPopupTextHaystack(popup);
        String category = popup.getCategory();

        return trackRepo.findAllWithMood(PageRequest.of(0, REVERSE_MATCH_CANDIDATE_POOL)).stream()
                .map(track -> scoreTrackForPopup(track, popupHaystack, category))
                .filter(match -> match.score() > 0)
                .sorted(Comparator.comparing(TrackMatch::score).reversed())
                .limit(limit)
                .toList();
    }

    /** 음악 패스포트 — 사용자 청취 기록. */
    public List<UserMusicHistory> userHistory(String userId, int limit) {
        return historyRepo.findByUserIdOrderByPlayedAtDesc(userId, PageRequest.of(0, limit));
    }

    /* =========================== matchPopups 의 단계들 =========================== */

    private MusicTrack findTrackOrThrow(Long trackId) {
        return trackRepo
                .findById(trackId)
                .orElseThrow(() -> new IllegalArgumentException("track not found: " + trackId));
    }

    private void ensureMoodTags(MusicTrack track) {
        if (track.getMoodTags() != null && !track.getMoodTags().isEmpty()) return;

        List<String> tags = moodService.analyze(track);
        track.setMoodTags(serializeTags(tags));
    }

    private void incrementPlayCount(MusicTrack track) {
        int current = track.getPlayCount() == null ? 0 : track.getPlayCount();
        track.setPlayCount(current + 1);
        track.setLastSearchedAt(LocalDateTime.now());
    }

    private void recordListeningHistory(String userId, MusicTrack track, List<PopupMatch> matches) {
        if (userId == null || userId.isBlank()) return;

        Long matchedPopupId = matches.isEmpty() ? null : matches.get(0).popupId();
        UserMusicHistory history =
                UserMusicHistory.builder()
                        .userId(userId)
                        .trackId(track.getId())
                        .matchedPopupId(matchedPopupId)
                        .build();
        historyRepo.save(history);
    }

    /* =========================== 캐시 / lazy fetch =========================== */

    /** Spotify 메타만 저장하고 YouTube 호출은 미루는 lazy 패턴. 검색 그리드를 빠르게 띄우는 용도. */
    private MusicTrack upsertTrackMetaOnly(SpotifySearchService.SpotifyTrack spotifyTrack) {
        MusicTrack track =
                trackRepo
                        .findBySpotifyTrackId(spotifyTrack.getSpotifyId())
                        .orElseGet(
                                () ->
                                        MusicTrack.builder()
                                                .spotifyTrackId(spotifyTrack.getSpotifyId())
                                                .build());

        track.setArtistName(spotifyTrack.getArtistName());
        track.setTrackName(spotifyTrack.getTrackName());
        track.setAlbumName(spotifyTrack.getAlbumName());
        track.setArtworkUrl(spotifyTrack.getArtworkUrl());
        track.setArtworkUrlHires(spotifyTrack.getArtworkUrlHires());
        track.setPreviewUrl(spotifyTrack.getPreviewUrl());
        track.setDurationMs(spotifyTrack.getDurationMs());
        track.setCachedAt(LocalDateTime.now());
        return trackRepo.save(track);
    }

    /** YouTube 영상 ID 가 비어있을 때만 검색해서 채운다. 이미 박혀있으면 호출 안 함. */
    private void ensureYoutubeVideoId(MusicTrack track) {
        if (hasYoutubeVideoId(track)) return;

        YouTubeMusicSearchService.YouTubeVideo video =
                youtube.searchOfficialAudio(track.getArtistName(), track.getTrackName());

        if (video != null) {
            track.setYoutubeVideoId(video.getVideoId());
            track.setYoutubeChannel(video.getChannelTitle());
            track.setIsOfficial(Boolean.TRUE.equals(video.getIsOfficial()));
        }
        track.setCachedAt(LocalDateTime.now());
    }

    /**
     * v2.21-S15 — preview_url 이 비어있으면 iTunes 에서 보충. Spotify 가 2024-11 부터 신규 앱의 preview_url 을 null 로
     * 막아, Free / 미연결 사용자가 깨끗한 미리듣기 대신 YouTube 로 폴백되던 문제 해결. 한 번 채우면 DB 캐시.
     */
    private void ensurePreviewUrl(MusicTrack track) {
        String existing = track.getPreviewUrl();
        if (existing != null && !existing.isBlank()) return;

        String preview = itunesPreview.findPreviewUrl(track.getArtistName(), track.getTrackName());
        if (preview != null) {
            track.setPreviewUrl(preview);
        }
    }

    /* =========================== 매칭 점수 =========================== */

    /** 무드 태그 → 팝업 매칭 (정방향). */
    private List<PopupMatch> matchByMood(List<String> moodTags, int limit) {
        if (moodTags == null || moodTags.isEmpty()) {
            return fallbackToTrendingPopups(limit);
        }

        return popupRepo.findAllPublic().stream()
                .map(p -> buildPopupMatch(p, moodTags))
                .filter(m -> m.score() > 0)
                .sorted(Comparator.comparing(PopupMatch::score).reversed())
                .limit(limit)
                .toList();
    }

    private List<PopupMatch> fallbackToTrendingPopups(int limit) {
        return popupRepo.findTrendingPublic(PageRequest.of(0, limit)).stream()
                .map(
                        p ->
                                new PopupMatch(
                                        p.getId(),
                                        p.getName(),
                                        p.getLocation(),
                                        p.getCategory(),
                                        p.getImageUrl(),
                                        FALLBACK_POPUP_SCORE))
                .toList();
    }

    private PopupMatch buildPopupMatch(PopupStore popup, List<String> moodTags) {
        int score = scorePopupAgainstMoods(popup, moodTags);
        return new PopupMatch(
                popup.getId(),
                popup.getName(),
                popup.getLocation(),
                popup.getCategory(),
                popup.getImageUrl(),
                score);
    }

    private int scorePopupAgainstMoods(PopupStore popup, List<String> moodTags) {
        String haystack = buildPopupTextHaystack(popup);
        int score = countTagMatches(haystack, moodTags, MUSIC_TO_POPUP_TAG_SCORE);
        score += calculateCategoryBonus(moodTags, popup.getCategory());
        return Math.min(MAX_MATCH_SCORE, score);
    }

    /** 역방향: 팝업 → 곡 매칭 점수 산정. */
    private TrackMatch scoreTrackForPopup(MusicTrack track, String popupHaystack, String category) {
        List<String> tags = parseTagsJson(track.getMoodTags());
        int score = countTagMatches(popupHaystack, tags, POPUP_TO_MUSIC_TAG_SCORE);
        score += calculateCategoryBonus(tags, category);
        return new TrackMatch(track, tags, Math.min(MAX_MATCH_SCORE, score));
    }

    private int countTagMatches(String haystack, List<String> tags, int scorePerTag) {
        int score = 0;
        for (String tag : tags) {
            if (haystack.contains(tag.toLowerCase())) score += scorePerTag;
        }
        return score;
    }

    /** 곡 무드와 팝업 카테고리의 정합성에 따른 가산점. */
    private int calculateCategoryBonus(List<String> tags, String category) {
        int bonus = 0;
        if (tags.contains(MOOD_DANCE) && CATEGORY_FASHION.equals(category)) {
            bonus += CATEGORY_BONUS_FASHION_DANCE;
        }
        if (tags.contains(MOOD_KITSCH) && CATEGORY_CHARACTER.equals(category)) {
            bonus += CATEGORY_BONUS_CHARACTER_KITSCH;
        }
        if (tags.contains(MOOD_CAFE) && CATEGORY_FOOD.equals(category)) {
            bonus += CATEGORY_BONUS_FOOD_CAFE;
        }
        return bonus;
    }

    private int similarityScore(List<String> a, List<String> b) {
        int score = 0;
        for (String tag : a) {
            if (b.contains(tag)) score += SIMILARITY_TAG_SCORE;
        }
        return score;
    }

    /* =========================== 단순 헬퍼 =========================== */

    private String buildPopupTextHaystack(PopupStore popup) {
        String name = popup.getName() == null ? "" : popup.getName();
        String description = popup.getDescription() == null ? "" : popup.getDescription();
        String content = popup.getContent() == null ? "" : popup.getContent();
        return (name + " " + description + " " + content).toLowerCase();
    }

    private boolean hasYoutubeVideoId(MusicTrack track) {
        return track.getYoutubeVideoId() != null && !track.getYoutubeVideoId().isBlank();
    }

    private List<String> parseTagsJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String serializeTags(List<String> tags) {
        try {
            return objectMapper.writeValueAsString(tags);
        } catch (Exception e) {
            return "[]";
        }
    }

    /* =========================== 내부 / 공개 DTO =========================== */

    private record RankedTrack(MusicTrack track, int score) {}

    public record PopupMatch(
            Long popupId,
            String name,
            String location,
            String category,
            String imageUrl,
            Integer score) {}

    public record MatchResult(MusicTrack track, List<String> moodTags, List<PopupMatch> popups) {}

    public record TrackMatch(MusicTrack track, List<String> moodTags, Integer score) {}
}
