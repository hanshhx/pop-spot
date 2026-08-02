package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.PopupStoreService;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PopupMapControllerTest {

    @Mock private PopupStoreService popupStoreService;

    @Test
    void lastModifiedUsesContentChangeTimeInsteadOfEveryCrawlSight() {
        PopupStore popup =
                PopupStore.builder()
                        .id(1L)
                        .name("테스트 팝업")
                        .crawledAt(LocalDateTime.of(2026, 7, 20, 4, 0))
                        .translatedAt(LocalDateTime.of(2026, 8, 2, 12, 0))
                        .lastSeenAt(LocalDateTime.of(2026, 8, 2, 16, 0))
                        .build();
        when(popupStoreService.findVisibleMapMarkers()).thenReturn(List.of(popup));

        PopupMapController.MapMarkerResponse marker =
                new PopupMapController(popupStoreService).getMapMarkers().getFirst();

        assertThat(marker.getLastModified()).isEqualTo("2026-08-02T12:00:00+09:00");
    }
}
