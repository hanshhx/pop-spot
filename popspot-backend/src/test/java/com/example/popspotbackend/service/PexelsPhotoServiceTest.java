package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PexelsPhotoServiceTest {

    private final PexelsPhotoService service = new PexelsPhotoService();

    @Test
    @DisplayName("Pexels 응답에서 사진 ID와 사진가 출처를 함께 보존한다")
    void parseCandidates_keepsAttributionMetadata() {
        Map<String, Object> photo =
                Map.of(
                        "id", 1234L,
                        "url", "https://www.pexels.com/photo/sample-1234/",
                        "photographer", "Sample Artist",
                        "photographer_url", "https://www.pexels.com/@sample-artist/",
                        "src",
                                Map.of(
                                        "portrait",
                                        "https://images.pexels.com/photos/1234/photo.jpeg"));

        List<PexelsPhotoService.PhotoCandidate> result =
                service.parseCandidates(Map.of("photos", List.of(photo)));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().id()).isEqualTo(1234L);
        assertThat(result.getFirst().photographerName()).isEqualTo("Sample Artist");
        assertThat(result.getFirst().photoPageUrl()).contains("pexels.com/photo/");
    }

    @Test
    @DisplayName("Pexels가 아닌 이미지 호스트는 저장 후보에서 제외한다")
    void parseCandidates_rejectsUntrustedImageHost() {
        Map<String, Object> photo =
                Map.of(
                        "id",
                        1234L,
                        "url",
                        "https://www.pexels.com/photo/sample-1234/",
                        "src",
                        Map.of("portrait", "https://example.com/copied-photo.jpeg"));

        assertThat(service.parseCandidates(Map.of("photos", List.of(photo)))).isEmpty();
    }
}
