package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupImageRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.PexelsPhotoService.PhotoCandidate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PopupPhotoServiceTest {

    @Test
    @DisplayName("이미 사용 중인 Pexels 사진 ID는 건너뛰고 다음 고유 사진을 배정한다")
    void assignPhotoIfMissing_skipsUsedPhotoId() {
        PopupStoreRepository popupStoreRepository = mock(PopupStoreRepository.class);
        PopupImageRepository imageRepository = mock(PopupImageRepository.class);
        PexelsPhotoService pexels = mock(PexelsPhotoService.class);
        PopupPhotoService service =
                new PopupPhotoService(popupStoreRepository, imageRepository, pexels);
        PopupStore popup =
                PopupStore.builder()
                        .id(2L)
                        .name("테스트 팝업")
                        .category("CULTURE")
                        .images(new ArrayList<>())
                        .build();
        PhotoCandidate used = candidate(10L);
        PhotoCandidate unused = candidate(11L);

        when(pexels.isConfigured()).thenReturn(true);
        when(imageRepository.findAllUsedPexelsPhotoIds()).thenReturn(List.of(10L));
        when(pexels.searchCandidates(anyString(), eq("CULTURE"), eq(1)))
                .thenReturn(List.of(used, unused));
        when(imageRepository.insertMainPexelsImageIfUnused(
                        eq(2L), eq(11L), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(1);

        assertThat(service.assignPhotoIfMissing(popup)).isTrue();
        verify(imageRepository)
                .insertMainPexelsImageIfUnused(
                        eq(2L), eq(11L), anyString(), anyString(), anyString(), anyString());
    }

    private static PhotoCandidate candidate(long id) {
        return new PhotoCandidate(
                id,
                "https://images.pexels.com/photos/" + id + "/photo.jpeg",
                "https://www.pexels.com/photo/" + id + "/",
                "Artist " + id,
                "https://www.pexels.com/@artist-" + id + "/");
    }
}
