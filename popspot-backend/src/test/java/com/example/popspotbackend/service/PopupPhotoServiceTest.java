package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
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
        when(imageRepository.findAllUsedPexelsImageUrls()).thenReturn(List.of());
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

    @Test
    @DisplayName("사진 ID가 비어 있던 과거 데이터도 같은 Pexels URL은 다시 배정하지 않는다")
    void assignPhotoIfMissing_skipsUsedImageUrl() {
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
        PhotoCandidate duplicatedUrl = candidate(10L);
        PhotoCandidate unused = candidate(11L);

        when(pexels.isConfigured()).thenReturn(true);
        when(imageRepository.findAllUsedPexelsPhotoIds()).thenReturn(List.of());
        when(imageRepository.findAllUsedPexelsImageUrls())
                .thenReturn(List.of(duplicatedUrl.imageUrl()));
        when(pexels.searchCandidates(anyString(), eq("CULTURE"), eq(1)))
                .thenReturn(List.of(duplicatedUrl, unused));
        when(imageRepository.insertMainPexelsImageIfUnused(
                        eq(2L), eq(11L), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(1);

        assertThat(service.assignPhotoIfMissing(popup)).isTrue();
        verify(imageRepository)
                .insertMainPexelsImageIfUnused(
                        eq(2L), eq(11L), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Pexels 키가 없으면 아무것도 시도하지 않고, 사진 없는 팝업 수는 그대로 알려 준다")
    void backfillMissingPhotos_reportsMissingKey() {
        PopupStoreRepository popupStoreRepository = mock(PopupStoreRepository.class);
        PopupImageRepository imageRepository = mock(PopupImageRepository.class);
        PexelsPhotoService pexels = mock(PexelsPhotoService.class);
        PopupPhotoService service =
                new PopupPhotoService(popupStoreRepository, imageRepository, pexels);

        when(pexels.isConfigured()).thenReturn(false);
        when(popupStoreRepository.findAllPublic())
                .thenReturn(List.of(photoless(1L), photoless(2L), photoless(3L)));

        PopupPhotoService.BackfillReport r = service.backfillMissingPhotos(150);

        // 예전에는 이 경우도 그냥 0 이라 "채울 것이 없음" 과 구별되지 않았다.
        assertThat(r.configured()).isFalse();
        assertThat(r.photoless()).isEqualTo(3);
        assertThat(r.scanned()).isZero();
        assertThat(r.assigned()).isZero();
    }

    @Test
    @DisplayName("사진 없는 팝업이 없으면 키가 있어도 0건이고, 그것이 정상임을 구분해 알려 준다")
    void backfillMissingPhotos_reportsNothingToDo() {
        PopupStoreRepository popupStoreRepository = mock(PopupStoreRepository.class);
        PopupImageRepository imageRepository = mock(PopupImageRepository.class);
        PexelsPhotoService pexels = mock(PexelsPhotoService.class);
        PopupPhotoService service =
                new PopupPhotoService(popupStoreRepository, imageRepository, pexels);

        when(pexels.isConfigured()).thenReturn(true);
        when(popupStoreRepository.findAllPublic()).thenReturn(List.of(withPhoto(1L)));
        when(imageRepository.findAllUsedPexelsPhotoIds()).thenReturn(List.of());
        when(imageRepository.findAllUsedPexelsImageUrls()).thenReturn(List.of());

        PopupPhotoService.BackfillReport r = service.backfillMissingPhotos(150);

        assertThat(r.configured()).isTrue();
        assertThat(r.photoless()).isZero();
        assertThat(r.assigned()).isZero();
    }

    @Test
    @DisplayName("limit 보다 대상이 많으면 남은 수를 알려 줘 몇 번 더 눌러야 하는지 보이게 한다")
    void backfillMissingPhotos_reportsRemainingBeyondLimit() {
        PopupStoreRepository popupStoreRepository = mock(PopupStoreRepository.class);
        PopupImageRepository imageRepository = mock(PopupImageRepository.class);
        PexelsPhotoService pexels = mock(PexelsPhotoService.class);
        PopupPhotoService service =
                new PopupPhotoService(popupStoreRepository, imageRepository, pexels);

        when(pexels.isConfigured()).thenReturn(true);
        when(popupStoreRepository.findAllPublic())
                .thenReturn(List.of(photoless(1L), photoless(2L), photoless(3L)));
        when(imageRepository.findAllUsedPexelsPhotoIds()).thenReturn(List.of());
        when(imageRepository.findAllUsedPexelsImageUrls()).thenReturn(List.of());
        // 검색이 아무것도 못 준 상태 — 키가 만료됐을 때의 모습이다.
        when(pexels.searchCandidates(anyString(), anyString(), anyInt())).thenReturn(List.of());

        PopupPhotoService.BackfillReport r = service.backfillMissingPhotos(2);

        assertThat(r.photoless()).isEqualTo(3);
        assertThat(r.scanned()).isEqualTo(2);
        assertThat(r.assigned()).isZero();
        // 시도한 둘 다 후보를 못 받았다 = 사람이 손볼 것이 있다는 신호.
        assertThat(r.searchEmpty()).isEqualTo(2);
    }

    private static PopupStore photoless(long id) {
        return PopupStore.builder()
                .id(id)
                .name("사진 없는 팝업 " + id)
                .category("CULTURE")
                .images(new ArrayList<>())
                .build();
    }

    private static PopupStore withPhoto(long id) {
        PopupStore p =
                PopupStore.builder()
                        .id(id)
                        .name("사진 있는 팝업 " + id)
                        .category("CULTURE")
                        .images(new ArrayList<>())
                        .build();
        p.getImages().add(com.example.popspotbackend.entity.PopupImage.builder().id(id).build());
        return p;
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
