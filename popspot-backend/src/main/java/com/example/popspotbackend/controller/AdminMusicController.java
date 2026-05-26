package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.music.MusicService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * v2.14 — 음악 캐시 운영용 어드민 API.
 *
 * <p>{@code POST /api/admin/music/refresh-covers} — cover / live / remix 의심 row 의 캐시된 youtube id 를
 * 일괄 초기화한다. 다음 재생 시 v2.14 새 필터로 다시 매칭되어 공식 음원만 박힌다.
 */
@RestController
@RequestMapping("/api/admin/music")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMusicController {

    private final MusicService musicService;

    @PostMapping("/refresh-covers")
    public ResponseEntity<Map<String, Integer>> refreshCovers() {
        return ResponseEntity.ok(musicService.clearLikelyCoverCache());
    }
}
