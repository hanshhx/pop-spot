package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupImageRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팝업 커버 사진 백필.
 *
 * <p>이미지(PopupImage)가 없는 공개 팝업은 {@code PopupStore.getImageUrl()} 이 단일 기본 이미지로 떨어진다. 여기서 Pexels 로 이름/카테고리에
 * 어울리는 사진을 찾아 대표 이미지(mainYn="Y")로 한 장 붙이면, 그 이후로는 각 팝업이 서로 다른 커버를 갖는다. 신규 수집분은 스케줄러가 주기적으로 채운다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupPhotoService {

    private final PopupStoreRepository popupStoreRepository;
    private final PopupImageRepository popupImageRepository;
    private final PexelsPhotoService pexelsPhotoService;

    /**
     * 이미지가 없는 공개 팝업에 Pexels 커버를 최대 {@code limit} 개 배정하고, 실제 배정한 개수를 반환한다. Pexels 키 미설정이면 0. 개별 실패는
     * 건너뛴다(방어적).
     */
    @Transactional
    public int backfillMissingPhotos(int limit) {
        if (!pexelsPhotoService.isConfigured()) {
            log.warn("[PopupPhotoService] Pexels 키 미설정 — 커버 백필 스킵");
            return 0;
        }
        List<PopupStore> targets =
                popupStoreRepository.findAllPublic().stream()
                        .filter(p -> p.getImages() == null || p.getImages().isEmpty())
                        .limit(Math.max(0, limit))
                        .toList();

        int assigned = 0;
        for (PopupStore p : targets) {
            try {
                Optional<String> url =
                        pexelsPhotoService.resolvePhotoUrl(p.getName(), p.getCategory(), p.getId());
                if (url.isPresent()) {
                    popupImageRepository.insertMainImage(p.getId(), url.get());
                    assigned++;
                }
            } catch (Exception e) {
                log.warn("[PopupPhotoService] id={} 커버 배정 실패 err={}", p.getId(), e.toString());
            }
        }
        log.info("[PopupPhotoService] 커버 백필 완료 — {}/{}개 배정", assigned, targets.size());
        return assigned;
    }
}
