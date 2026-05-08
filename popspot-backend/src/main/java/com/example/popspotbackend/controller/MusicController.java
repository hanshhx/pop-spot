package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.MusicTrack;
import com.example.popspotbackend.entity.UserMusicHistory;
import com.example.popspotbackend.service.music.MusicService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 음악 → 팝업 매칭 API.
 *  GET  /api/music/search?q=...        — 곡 검색 (그리드)
 *  GET  /api/music/popular              — 인기 차트
 *  POST /api/music/{trackId}/play       — 재생 + 분위기 분석 + 팝업 매칭
 *  POST /api/music/roulette             — 운명의 곡 룰렛
 *  GET  /api/music/history              — 음악 패스포트 (로그인 사용자)
 */
@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
public class MusicController {

    private final MusicService musicService;

    @GetMapping("/search")
    public List<MusicTrack> search(@RequestParam("q") String query,
                                   @RequestParam(value = "limit", defaultValue = "12") int limit) {
        return musicService.searchTracks(sanitizeQuery(query), clampLimit(limit, 25));
    }

    @GetMapping("/popular")
    public List<MusicTrack> popular(@RequestParam(value = "limit", defaultValue = "12") int limit) {
        return musicService.popular(clampLimit(limit, 50));
    }

    @PostMapping("/{trackId}/play")
    public MusicService.MatchResult play(@PathVariable Long trackId,
                                          @AuthenticationPrincipal UserDetails user) {
        String userId = user != null ? user.getUsername() : null;
        return musicService.matchPopups(trackId, userId);
    }

    @PostMapping("/roulette")
    public MusicService.MatchResult roulette(@AuthenticationPrincipal UserDetails user) {
        String userId = user != null ? user.getUsername() : null;
        return musicService.roulette(userId);
    }

    /** 역방향 매칭: 팝업 ID → 어울리는 곡 N개 */
    @GetMapping("/by-popup/{popupId}")
    public List<MusicService.TrackMatch> byPopup(@PathVariable Long popupId,
                                                  @RequestParam(value = "limit", defaultValue = "5") int limit) {
        return musicService.matchTracksForPopup(popupId, limit);
    }

    @GetMapping("/history")
    public List<UserMusicHistory> history(@AuthenticationPrincipal UserDetails user,
                                          @RequestParam(value = "limit", defaultValue = "30") int limit) {
        if (user == null) return List.of();
        return musicService.userHistory(user.getUsername(), limit);
    }

    /**
     * 카테고리 키워드로 곡 그리드 채우기.
     * 카테고리는 프론트에서 정의하고 그 키워드를 query 로 그대로 넘긴다.
     */
    @GetMapping("/category")
    public List<MusicTrack> category(@RequestParam("keyword") String keyword,
                                      @RequestParam(value = "limit", defaultValue = "12") int limit) {
        return musicService.tracksForCategory(sanitizeQuery(keyword), clampLimit(limit, 25));
    }

    /** 현재 재생 곡 종료 시 호출 — 다음 자동 재생용 추천 큐 */
    @GetMapping("/{trackId}/next")
    public List<MusicTrack> nextRecommendations(@PathVariable Long trackId,
                                                 @RequestParam(value = "limit", defaultValue = "5") int limit) {
        return musicService.recommendNext(trackId, clampLimit(limit, 20));
    }

    /* ----- 입력 검증 유틸 ----- */

    /**
     * 검색어 길이/공백 정리.
     * 너무 긴 입력은 외부 API 호출만 무거워지므로 잘라낸다.
     */
    private String sanitizeQuery(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        if (trimmed.length() > 80) trimmed = trimmed.substring(0, 80);
        return trimmed;
    }

    private int clampLimit(int requested, int max) {
        if (requested < 1) return 1;
        return Math.min(requested, max);
    }
}
