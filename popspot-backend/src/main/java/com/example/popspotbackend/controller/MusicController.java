package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.MusicTrack;
import com.example.popspotbackend.entity.UserMusicHistory;
import com.example.popspotbackend.service.music.MusicService;
import com.example.popspotbackend.service.music.SearchSuggestService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 음악 → 팝업 매칭 API.
 *
 * <p>주요 엔드포인트: {@code /search} 곡 검색, {@code /popular} 인기 차트, {@code /{id}/play} 재생 + 분위기 분석 + 팝업
 * 매칭, {@code /roulette} 운명의 곡 룰렛, {@code /history} 음악 패스포트, {@code /by-popup/{id}} 팝업 → 곡 역추천.
 */
@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
public class MusicController {

    private static final int MAX_QUERY_LENGTH = 80;

    private static final int DEFAULT_GRID_LIMIT = 12;
    private static final int MAX_GRID_LIMIT = 25;

    private static final int DEFAULT_SUGGEST_LIMIT = 8;
    private static final int MAX_SUGGEST_LIMIT = 12;

    private static final int DEFAULT_POPULAR_LIMIT = 12;
    private static final int MAX_POPULAR_LIMIT = 50;

    private static final int DEFAULT_BY_POPUP_LIMIT = 5;

    private static final int DEFAULT_HISTORY_LIMIT = 30;

    private static final int DEFAULT_NEXT_LIMIT = 5;
    private static final int MAX_NEXT_LIMIT = 20;

    private final MusicService musicService;
    private final SearchSuggestService suggestService;

    @GetMapping("/search")
    public List<MusicTrack> search(
            @RequestParam("q") String query,
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_GRID_LIMIT) int limit) {
        return musicService.searchTracks(sanitizeQuery(query), clampLimit(limit, MAX_GRID_LIMIT));
    }

    /** 검색어 자동완성. YouTube Suggest 후보를 정렬해 돌려준다. */
    @GetMapping("/suggest")
    public List<String> suggest(
            @RequestParam("q") String query,
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_SUGGEST_LIMIT) int limit) {
        return suggestService.suggest(sanitizeQuery(query), clampLimit(limit, MAX_SUGGEST_LIMIT));
    }

    @GetMapping("/popular")
    public List<MusicTrack> popular(
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_POPULAR_LIMIT) int limit) {
        return musicService.popular(clampLimit(limit, MAX_POPULAR_LIMIT));
    }

    @PostMapping("/{trackId}/play")
    public MusicService.MatchResult play(
            @PathVariable Long trackId, @AuthenticationPrincipal UserDetails user) {
        return musicService.matchPopups(trackId, usernameOrNull(user));
    }

    @PostMapping("/roulette")
    public MusicService.MatchResult roulette(@AuthenticationPrincipal UserDetails user) {
        return musicService.roulette(usernameOrNull(user));
    }

    /** 역방향 매칭: 팝업 ID → 어울리는 곡 N개. */
    @GetMapping("/by-popup/{popupId}")
    public List<MusicService.TrackMatch> byPopup(
            @PathVariable Long popupId,
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_BY_POPUP_LIMIT) int limit) {
        return musicService.matchTracksForPopup(popupId, limit);
    }

    @GetMapping("/history")
    public List<UserMusicHistory> history(
            @AuthenticationPrincipal UserDetails user,
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_HISTORY_LIMIT) int limit) {
        if (user == null) return List.of();
        return musicService.userHistory(user.getUsername(), limit);
    }

    /** 카테고리 키워드로 곡 그리드 채우기. 카테고리는 프론트에서 정의하고 keyword 로 그대로 넘긴다. */
    @GetMapping("/category")
    public List<MusicTrack> category(
            @RequestParam("keyword") String keyword,
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_GRID_LIMIT) int limit) {
        return musicService.tracksForCategory(
                sanitizeQuery(keyword), clampLimit(limit, MAX_GRID_LIMIT));
    }

    /** 현재 곡 종료 시 다음 자동 재생을 위한 추천 큐. */
    @GetMapping("/{trackId}/next")
    public List<MusicTrack> nextRecommendations(
            @PathVariable Long trackId,
            @RequestParam(value = "limit", defaultValue = "" + DEFAULT_NEXT_LIMIT) int limit) {
        return musicService.recommendNext(trackId, clampLimit(limit, MAX_NEXT_LIMIT));
    }

    /* ============================== 입력 검증 ============================== */

    /** 검색어 trim + 길이 상한. 너무 긴 입력은 외부 API 호출을 무겁게만 하므로 잘라낸다. */
    private String sanitizeQuery(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        if (trimmed.length() > MAX_QUERY_LENGTH) {
            return trimmed.substring(0, MAX_QUERY_LENGTH);
        }
        return trimmed;
    }

    private int clampLimit(int requested, int max) {
        if (requested < 1) return 1;
        return Math.min(requested, max);
    }

    private String usernameOrNull(UserDetails user) {
        return user != null ? user.getUsername() : null;
    }
}
