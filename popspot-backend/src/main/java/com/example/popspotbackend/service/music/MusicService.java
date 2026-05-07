package com.example.popspotbackend.service.music;

import com.example.popspotbackend.entity.MusicTrack;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.UserMusicHistory;
import com.example.popspotbackend.repository.MusicTrackRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserMusicHistoryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 음악 → 팝업 매칭 메인 서비스.
 * 흐름:
 *  1. iTunes 검색 → 정식 메타데이터
 *  2. YouTube 검색 → 영상 ID (공식 음원 우선)
 *  3. Groq 분위기 분석 → 키워드 5개
 *  4. popup_store 의 description/category 와 키워드 교집합 → 매칭 점수
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicService {

    private final ITunesSearchService itunes;
    private final YouTubeMusicSearchService youtube;
    private final MusicMoodAnalysisService moodService;
    private final MusicTrackRepository trackRepo;
    private final UserMusicHistoryRepository historyRepo;
    private final PopupStoreRepository popupRepo;
    private final ObjectMapper mapper = new ObjectMapper();

    /** 검색 결과 그리드용 — iTunes 검색 + YouTube 매칭 (mood 분석 없이 빠르게) */
    @Transactional
    public List<MusicTrack> searchTracks(String query, int limit) {
        List<ITunesSearchService.ITunesTrack> candidates = itunes.search(query, limit);
        List<MusicTrack> result = new ArrayList<>();

        for (ITunesSearchService.ITunesTrack it : candidates) {
            MusicTrack track = trackRepo.findByItunesTrackId(it.getTrackId())
                    .filter(MusicTrack::isCacheFresh)
                    .orElseGet(() -> upsertTrack(it));
            result.add(track);
        }
        return result;
    }

    /** 곡 1개의 분위기 분석 + 팝업 매칭 (재생 직전 lazy 분석) */
    @Transactional
    public MatchResult matchPopups(Long trackId, String userId) {
        MusicTrack track = trackRepo.findById(trackId)
                .orElseThrow(() -> new IllegalArgumentException("track not found: " + trackId));

        // 분위기 분석 캐시
        if (track.getMoodTags() == null || track.getMoodTags().isEmpty()) {
            List<String> tags = moodService.analyze(track);
            try {
                track.setMoodTags(mapper.writeValueAsString(tags));
            } catch (Exception e) {
                track.setMoodTags("[]");
            }
        }

        // 재생 카운트 + 청취 기록
        track.setPlayCount((track.getPlayCount() == null ? 0 : track.getPlayCount()) + 1);
        track.setLastSearchedAt(LocalDateTime.now());
        trackRepo.save(track);

        List<String> moodTags = parseTagsJson(track.getMoodTags());

        // 팝업 매칭
        List<PopupMatch> matches = matchByMood(moodTags, 5);

        // 사용자 히스토리 저장 (로그인 사용자만)
        if (userId != null && !userId.isBlank()) {
            UserMusicHistory history = UserMusicHistory.builder()
                    .userId(userId)
                    .trackId(track.getId())
                    .matchedPopupId(matches.isEmpty() ? null : matches.get(0).popupId())
                    .build();
            historyRepo.save(history);
        }

        return new MatchResult(track, moodTags, matches);
    }

    /** 운명의 곡 룰렛 — 무드 태그 있는 곡 중 랜덤 1개 + 매칭 */
    @Transactional
    public MatchResult roulette(String userId) {
        MusicTrack track = trackRepo.findRandomWithMood()
                .orElseThrow(() -> new IllegalStateException("아직 운명의 곡 풀이 비어있습니다 — 먼저 곡 검색을 해주세요."));
        return matchPopups(track.getId(), userId);
    }

    /** 인기 트랙 (홈 인기차트용) */
    public List<MusicTrack> popular(int limit) {
        return trackRepo.findTopPlayed(PageRequest.of(0, limit));
    }

    /**
     * 역방향 매칭 — 팝업 → 어울리는 곡 N개.
     * 팝업의 description/content/category 에서 키워드를 뽑고,
     * 곡의 moodTags 와 겹치는 정도로 점수화.
     */
    public List<TrackMatch> matchTracksForPopup(Long popupId, int limit) {
        PopupStore popup = popupRepo.findById(popupId).orElse(null);
        if (popup == null) return List.of();

        String haystack = ((popup.getName() != null ? popup.getName() : "") + " "
                + (popup.getDescription() != null ? popup.getDescription() : "") + " "
                + (popup.getContent() != null ? popup.getContent() : "")).toLowerCase();
        String category = popup.getCategory();

        List<MusicTrack> candidates = trackRepo.findAllWithMood(PageRequest.of(0, 500));

        return candidates.stream()
                .map(t -> {
                    List<String> tags = parseTagsJson(t.getMoodTags());
                    int score = 0;
                    for (String tag : tags) {
                        if (haystack.contains(tag.toLowerCase())) score += 25;
                    }
                    // 카테고리 ↔ 태그 보너스 (matchByMood 와 대칭)
                    if ("FASHION".equals(category) && tags.contains("댄스")) score += 10;
                    if ("CHARACTER".equals(category) && tags.contains("키치")) score += 15;
                    if ("FOOD".equals(category) && tags.contains("카페")) score += 15;
                    return new TrackMatch(t, tags, Math.min(100, score));
                })
                .filter(m -> m.score() > 0)
                .sorted(Comparator.comparing(TrackMatch::score).reversed())
                .limit(limit)
                .toList();
    }

    /** 음악 패스포트 — 사용자 청취 기록 N개 */
    public List<UserMusicHistory> userHistory(String userId, int limit) {
        return historyRepo.findByUserIdOrderByPlayedAtDesc(userId, PageRequest.of(0, limit));
    }

    // ----------------------- private helpers -----------------------

    private MusicTrack upsertTrack(ITunesSearchService.ITunesTrack it) {
        // YouTube 영상 매칭 (공식 음원 우선)
        YouTubeMusicSearchService.YouTubeVideo video =
                youtube.searchOfficialAudio(it.getArtistName(), it.getTrackName());

        MusicTrack track = trackRepo.findByItunesTrackId(it.getTrackId())
                .orElseGet(() -> MusicTrack.builder()
                        .itunesTrackId(it.getTrackId())
                        .build());

        track.setArtistName(it.getArtistName());
        track.setTrackName(it.getTrackName());
        track.setAlbumName(it.getAlbumName());
        track.setArtworkUrl(it.getArtworkUrl());
        track.setArtworkUrlHires(it.getArtworkUrlHires());
        track.setPreviewUrl(it.getPreviewUrl());
        track.setDurationMs(it.getDurationMs());
        if (video != null) {
            track.setYoutubeVideoId(video.getVideoId());
            track.setYoutubeChannel(video.getChannelTitle());
            track.setIsOfficial(Boolean.TRUE.equals(video.getIsOfficial()));
        }
        track.setCachedAt(LocalDateTime.now());
        return trackRepo.save(track);
    }

    /** 무드 태그 → popup_store 매칭. 단순 키워드 contains 점수 */
    private List<PopupMatch> matchByMood(List<String> moodTags, int limit) {
        if (moodTags == null || moodTags.isEmpty()) {
            // 무드 없으면 인기 popup 폴백
            return popupRepo.findTrendingPublic(PageRequest.of(0, limit)).stream()
                    .map(p -> new PopupMatch(p.getId(), p.getName(), p.getLocation(),
                            p.getCategory(), p.getImageUrl(), 50))
                    .toList();
        }

        // 활성 popup 전체 가져와 매칭 점수 계산
        List<PopupStore> candidates = popupRepo.findAllPublic();

        return candidates.stream()
                .map(p -> new PopupMatch(
                        p.getId(), p.getName(), p.getLocation(),
                        p.getCategory(), p.getImageUrl(),
                        scoreMatch(p, moodTags)))
                .filter(m -> m.score() > 0)
                .sorted(Comparator.comparing(PopupMatch::score).reversed())
                .limit(limit)
                .toList();
    }

    private int scoreMatch(PopupStore p, List<String> moodTags) {
        String haystack = ((p.getName() != null ? p.getName() : "") + " "
                + (p.getDescription() != null ? p.getDescription() : "") + " "
                + (p.getContent() != null ? p.getContent() : "")).toLowerCase();

        int score = 0;
        for (String tag : moodTags) {
            if (haystack.contains(tag.toLowerCase())) score += 30;
        }
        // 카테고리 일치 보너스
        if (moodTags.contains("댄스") && "FASHION".equals(p.getCategory())) score += 10;
        if (moodTags.contains("키치") && "CHARACTER".equals(p.getCategory())) score += 15;
        if (moodTags.contains("카페") && "FOOD".equals(p.getCategory())) score += 15;
        return Math.min(100, score);
    }

    private List<String> parseTagsJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return mapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    // ----------------------- DTO records -----------------------

    public record PopupMatch(
            Long popupId,
            String name,
            String location,
            String category,
            String imageUrl,
            Integer score
    ) {}

    public record MatchResult(
            MusicTrack track,
            List<String> moodTags,
            List<PopupMatch> popups
    ) {}

    /** 역방향: 팝업 → 곡 매칭 결과 한 줄 */
    public record TrackMatch(
            MusicTrack track,
            List<String> moodTags,
            Integer score
    ) {}
}
