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
     * 커버 백필 한 번의 결과 — <b>0건이 왜 0건인지</b>까지 담는다.
     *
     * <p>예전에는 배정 개수(int)만 돌려줬다. 그런데 0 이 나오는 길이 셋인데 셋 다 똑같이 0 으로 보였다 — 키가 없어서, Pexels 호출이 실패해서, 정말
     * 채울 것이 없어서. 관리자 화면에서는 <b>키가 빠진 것과 할 일이 없는 것이 구별되지 않아</b> 기능이 죽은 줄 알고도 그냥 성공 알림이 떴다.
     *
     * @param configured Pexels 키가 설정돼 있는가. false 면 아무 것도 하지 않았다는 뜻이다.
     * @param photoless 사진이 하나도 없는 공개 팝업 <b>전체</b> 수. {@code limit} 과 무관하다 — 몇 번 더 눌러야 하는지 알 수 있다.
     * @param scanned 이번에 실제로 시도한 수({@code min(photoless, limit)}).
     * @param assigned 사진이 붙은 수.
     * @param searchEmpty Pexels 검색이 <b>후보를 한 장도</b> 돌려주지 않은 팝업 수. 이 값이 scanned 와 같으면 키가 만료됐거나 쿼터가 찬
     *     것이다(코드 문제가 아니다).
     */
    public record BackfillReport(
            boolean configured, int photoless, int scanned, int assigned, int searchEmpty) {}

    /**
     * 이미지가 없는 공개 팝업에 Pexels 커버를 최대 {@code limit} 개 배정한다. 개별 실패는 건너뛴다(방어적).
     *
     * @return 무엇을 왜 했는지 담은 {@link BackfillReport}
     */
    @Transactional
    public BackfillReport backfillMissingPhotos(int limit) {
        List<PopupStore> photoless =
                popupStoreRepository.findAllPublic().stream()
                        .filter(p -> p.getImages() == null || p.getImages().isEmpty())
                        .toList();

        if (!pexelsPhotoService.isConfigured()) {
            log.warn(
                    "[PopupPhotoService] Pexels 키 미설정 — 커버 백필 스킵 (사진 없는 팝업 {}건)", photoless.size());
            return new BackfillReport(false, photoless.size(), 0, 0, 0);
        }

        List<PopupStore> targets = photoless.stream().limit(Math.max(0, limit)).toList();
        Set<Long> usedPhotoIds = new HashSet<>(popupImageRepository.findAllUsedPexelsPhotoIds());
        Set<String> usedImageUrls =
                new HashSet<>(popupImageRepository.findAllUsedPexelsImageUrls());
        Map<String, List<PhotoCandidate>> requestCache = new HashMap<>();
        int assigned = 0;
        int searchEmpty = 0;
        for (PopupStore p : targets) {
            try {
                if (assignUniquePhoto(p, usedPhotoIds, usedImageUrls, requestCache)) assigned++;
                else if (noCandidateAtAll(p, requestCache)) searchEmpty++;
            } catch (Exception e) {
                log.warn("[PopupPhotoService] id={} 커버 배정 실패 err={}", p.getId(), e.toString());
            }
        }
        log.info(
                "[PopupPhotoService] 커버 백필 완료 — {}/{}개 배정 (사진 없는 팝업 {}건, 검색결과 빈 팝업 {}건)",
                assigned,
                targets.size(),
                photoless.size(),
                searchEmpty);
        return new BackfillReport(true, photoless.size(), targets.size(), assigned, searchEmpty);
    }

    /**
     * 이 팝업의 검색이 <b>후보를 한 장도</b> 못 받았는가.
     *
     * <p>배정 실패의 이유를 둘로 가른다 — 후보는 왔는데 전부 이미 쓴 사진이라 못 붙인 경우(정상적인 고갈)와, 애초에 Pexels 가 아무것도 안 준 경우(키
     * 만료·쿼터 초과·차단). 뒤쪽이면 사람이 손볼 것이 있다.
     *
     * <p>{@code requestCache} 를 다시 읽을 뿐 네트워크를 새로 부르지 않는다 — 방금 {@link #assignUniquePhoto} 가 채워 둔
     * 값이다.
     */
    private boolean noCandidateAtAll(
            PopupStore popup, Map<String, List<PhotoCandidate>> requestCache) {
        String cacheKey = popup.getCategory() + "|" + photoQueryBucket(popup.getName()) + "|1";
        List<PhotoCandidate> first = requestCache.get(cacheKey);
        return first != null && first.isEmpty();
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
        Set<String> usedImageUrls =
                new HashSet<>(popupImageRepository.findAllUsedPexelsImageUrls());
        return assignUniquePhoto(popup, usedPhotoIds, usedImageUrls, new HashMap<>());
    }

    private boolean assignUniquePhoto(
            PopupStore popup,
            Set<Long> usedPhotoIds,
            Set<String> usedImageUrls,
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
                if (usedPhotoIds.contains(candidate.id())
                        || usedImageUrls.contains(candidate.imageUrl())) continue;

                int inserted =
                        popupImageRepository.insertMainPexelsImageIfUnused(
                                popup.getId(),
                                candidate.id(),
                                candidate.imageUrl(),
                                candidate.photoPageUrl(),
                                candidate.photographerName(),
                                candidate.photographerUrl());
                usedPhotoIds.add(candidate.id());
                usedImageUrls.add(candidate.imageUrl());
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
