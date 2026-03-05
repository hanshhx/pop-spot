package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.PopupStoreService;
import com.example.popspotbackend.service.YouTubeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/popups")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class PopupStoreController {

    private final PopupStoreService popupStoreService;
    private final YouTubeService youTubeService;

    // 🔥 [에러 해결 1] Repository를 사용하기 위해 '작업자'를 불러옵니다.
    private final PopupStoreRepository popupStoreRepository;

    // 1. 전체 조회
    @GetMapping
    public ResponseEntity<List<PopupStore>> getAllPopups(@RequestParam(required = false) String category) {
        List<PopupStore> popups = popupStoreService.getAllPopups(category);
        return ResponseEntity.ok(popups);
    }

    // 2. 상세 조회
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getPopupById(@PathVariable Long id) {
        PopupStore popup = popupStoreService.getPopupById(id);
        // (할당량 아끼려면 실제 배포시엔 주석 처리 하거나 DB 저장 방식 고려)
        String videoId = youTubeService.searchVideoId(popup.getName());

        Map<String, Object> result = new HashMap<>();
        result.put("data", popup);
        result.put("imageUrl", popup.getImageUrl());
        result.put("videoId", videoId);

        return ResponseEntity.ok(result);
    }

    // 3. 인기 팝업
    @GetMapping("/trending")
    public ResponseEntity<List<PopupStore>> getTrendingPopups() {
        List<PopupStore> trendingList = popupStoreService.getTrendingPopups();
        return ResponseEntity.ok(trendingList);
    }

    // 4. 🔥 [수정됨] 검색 API
    @GetMapping("/search")
    public ResponseEntity<List<PopupStore>> searchPopups(@RequestParam String keyword) {
        // 검색어가 없으면 빈 리스트 반환
        if (keyword == null || keyword.trim().isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        // [수정] repository 직접 호출(X) -> service 호출(O)
        // 이제 에러가 사라집니다.
        List<PopupStore> results = popupStoreService.searchPopups(keyword);

        return ResponseEntity.ok(results);
    }

    // 🔥 [추가] 유저가 팝업스토어를 제보하는 API
    @PostMapping("/report")
    public ResponseEntity<PopupStore> reportPopup(@RequestBody PopupStore popupStore) {
        // 무조건 대기 상태로 저장
        popupStore.setStatus("PENDING");
        // 조회수는 0으로 시작
        popupStore.setViewCount(0);

        // 🔥 [에러 해결 2] 대문자 P가 아닌 소문자 p(실제 작업자 객체)로 save를 호출합니다!
        PopupStore saved = popupStoreRepository.save(popupStore);
        return ResponseEntity.ok(saved);
    }
}