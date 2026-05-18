package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.PopupStoreService;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 지도 핀 표시를 위한 경량 응답. 좌표는 PopupStore 의 String 그대로 직렬화한다. */
@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class PopupMapController {

    private final PopupStoreService popupStoreService;

    @GetMapping("/markers")
    public List<MapMarkerResponse> getMapMarkers() {
        return popupStoreService.findVisibleMapMarkers().stream().map(this::toMarker).toList();
    }

    private MapMarkerResponse toMarker(PopupStore store) {
        return MapMarkerResponse.builder()
                .id(store.getId())
                .name(store.getName())
                .location(store.getLocation())
                .latitude(store.getLatitude())
                .longitude(store.getLongitude())
                .build();
    }

    @Getter
    @Builder
    public static class MapMarkerResponse {
        private Long id;
        private String name;
        private String location;
        private String latitude;
        private String longitude;
    }
}
