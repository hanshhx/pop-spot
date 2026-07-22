package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupImageRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.PexelsPhotoService.PhotoCandidate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팝업 커버 사진 백필.
 *
 * <p>이미지(PopupImage)가 없는 공개 팝업은 {@code PopupStore.getImageUrl()} 이 단일 기본 이미지로 떨어진다. 여기서 Pexels 로
 * 이름/카테고리에 어울리는 사진을 찾아 대표 이미지(mainYn="Y")로 한 장 붙이면, 그 이후로는 각 팝업이 서로 다른 커버를 갖는다. 신규 수집분은 스케줄러가 주기적으로
 * 채운다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupPhotoService {

    private static final int MAX_SEARCH_PAGES = 5;

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

        Set<Long> usedPhotoIds = new HashSet<>(popupImageRepository.findAllUsedPexelsPhotoIds());
        Map<String, List<PhotoCandidate>> requestCache = new HashMap<>();
        int assigned = 0;
        for (PopupStore p : targets) {
            try {
                if (assignUniquePhoto(p, usedPhotoIds, requestCache)) assigned++;
            } catch (Exception e) {
                log.warn("[PopupPhotoService] id={} 커버 배정 실패 err={}", p.getId(), e.toString());
            }
        }
        log.info("[PopupPhotoService] 커버 백필 완료 — {}/{}개 배정", assigned, targets.size());
        return assigned;
    }

    /** 신규 수집 팝업 저장 직후 사진 한 장을 배정한다. 실패 시 빈 상태로 두며 다음 정기 백필에서 다시 시도한다. */
    @Transactional
    public boolean assignPhotoIfMissing(PopupStore popup) {
        if (!pexelsPhotoService.isConfigured()
                || popup == null
                || popup.getId() == null
                || (popup.getImages() != null && !popup.getImages().isEmpty())) {
            return false;
        }
        Set<Long> usedPhotoIds = new HashSet<>(popupImageRepository.findAllUsedPexelsPhotoIds());
        return assignUniquePhoto(popup, usedPhotoIds, new HashMap<>());
    }

    private boolean assignUniquePhoto(
            PopupStore popup,
            Set<Long> usedPhotoIds,
            Map<String, List<PhotoCandidate>> requestCache) {
        for (int page = 1; page <= MAX_SEARCH_PAGES; page++) {
            String cacheKey =
                    popup.getCategory() + "|" + photoQueryBucket(popup.getName()) + "|" + page;
            int searchPage = page;
            List<PhotoCandidate> candidates =
                    requestCache.computeIfAbsent(
                            cacheKey,
                            ignored ->
                                    pexelsPhotoService.searchCandidates(
                                            popup.getName(), popup.getCategory(), searchPage));
            if (candidates.isEmpty()) break;

            int start = (int) Math.floorMod(popup.getId(), candidates.size());
            for (int offset = 0; offset < candidates.size(); offset++) {
                PhotoCandidate candidate = candidates.get((start + offset) % candidates.size());
                if (usedPhotoIds.contains(candidate.id())) continue;

                int inserted =
                        popupImageRepository.insertMainPexelsImageIfUnused(
                                popup.getId(),
                                candidate.id(),
                                candidate.imageUrl(),
                                candidate.photoPageUrl(),
                                candidate.photographerName(),
                                candidate.photographerUrl());
                usedPhotoIds.add(candidate.id());
                if (inserted == 1) return true;
            }
        }
        log.warn("[PopupPhotoService] id={}에 배정할 미사용 Pexels 사진이 없음", popup.getId());
        return false;
    }

    /** 검색 결과 캐시를 공유할 수 있도록 이름을 Pexels 검색 규칙과 같은 일반 주제 버킷으로 축약한다. */
    private static String photoQueryBucket(String name) {
        if (name == null) return "default";
        if (containsAny(name, "베이글", "빵", "베이커리", "브레드")) return "bakery";
        if (containsAny(name, "커피", "카페")) return "cafe";
        if (containsAny(name, "도넛")) return "donut";
        if (containsAny(name, "케이크", "디저트")) return "dessert";
        if (containsAny(name, "향수", "퍼퓸")) return "perfume";
        if (containsAny(name, "화장품", "뷰티", "코스메틱", "메이크업")) return "beauty";
        if (containsAny(name, "전시", "아트", "미술", "갤러리")) return "gallery";
        if (containsAny(name, "캐릭터", "피규어", "인형", "토이", "장난감")) return "toy";
        if (containsAny(name, "꽃", "플라워")) return "flower";
        if (containsAny(name, "와인", "위스키", "칵테일")) return "drinks";
        if (containsAny(name, "패션", "의류", "브랜드")) return "fashion";
        if (containsAny(name, "가전", "테크", "전자")) return "tech";
        return "default";
    }

    private static boolean containsAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.contains(candidate)) return true;
        }
        return false;
    }
}
