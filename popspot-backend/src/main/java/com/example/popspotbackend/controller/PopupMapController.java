package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class PopupMapController {

    private final PopupStoreRepository popupStoreRepository;

    /**
     * [로직 해석]
     * 1. DB의 모든 팝업 데이터를 조회합니다.
     * 2. 엔티티의 데이터를 지도 전용 응답 객체(DTO)로 변환합니다.
     */
    @GetMapping("/markers")
    public List<MapMarkerResponse> getMapMarkers() {
        // [로직 해석] findAll()로 전체 데이터를 가져와 Stream API로 가공합니다.
        return popupStoreRepository.findAll().stream()
                // 🔥 [추가 필터링] 지도에 핀을 꽂기 전에 PENDING 상태인 팝업은 제외합니다.
                .filter(store -> store.getStatus() == null || !store.getStatus().equals("PENDING"))
                .map(store -> MapMarkerResponse.builder()
                        .id(store.getId())
                        .name(store.getName())
                        .location(store.getLocation())
                        // [해결] 엔티티의 타입(String)과 DTO의 타입을 일치시켜 에러를 제거했습니다.
                        .latitude(store.getLatitude())
                        .longitude(store.getLongitude())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * [로직 해석]
     * 지도 마커 표시를 위한 전용 데이터 구조입니다.
     * 현재 엔티티 구조에 맞춰 위도/경도 타입을 String으로 설정했습니다.
     */
    @Getter
    @Builder
    public static class MapMarkerResponse {
        private Long id;
        private String name;
        private String location;
        private String latitude;  // [변경] Double에서 String으로 타입 수정
        private String longitude; // [변경] Double에서 String으로 타입 수정
    }
}