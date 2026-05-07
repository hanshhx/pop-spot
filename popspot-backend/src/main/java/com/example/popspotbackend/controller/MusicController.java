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
        return musicService.searchTracks(query, limit);
    }

    @GetMapping("/popular")
    public List<MusicTrack> popular(@RequestParam(value = "limit", defaultValue = "12") int limit) {
        return musicService.popular(limit);
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
}
