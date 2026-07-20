package com.example.popspotbackend.service;

import com.example.popspotbackend.config.CacheConfig;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 중복 팝업 정리 — 이름이 <b>완전히 동일한</b>(공백 트림 제외 후 정확히 같은) 레코드만 중복으로 본다.
 *
 * <p>피스마이너스원×토이스토리 vs 피마원 X 토이스토리 같은 표기 변형은 서로 다른 것으로 두고 건드리지 않는다. 같은 이름이 여러 건이면 대표 1건(신뢰도 높은 순 →
 * id 낮은 순)만 남기고 나머지는 {@code reviewStatus=DUPLICATE} 로 숨기고(지도·검색 노출 제외) Algolia 색인에서도 제거한다. 하드 삭제가
 * 아니라 숨김이라 되돌릴 수 있다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupDedupService {

    private static final String DUPLICATE_STATUS = "DUPLICATE";

    /** 대표 선정: 신뢰도 높은 것 우선(null 은 최저), 동률이면 id 작은(먼저 수집된) 것. */
    private static final Comparator<PopupStore> KEEPER_ORDER =
            Comparator.comparing(
                            (PopupStore p) ->
                                    p.getConfidenceScore() == null
                                            ? BigDecimal.valueOf(-1)
                                            : p.getConfidenceScore(),
                            Comparator.reverseOrder())
                    .thenComparing(PopupStore::getId);

    private final PopupStoreRepository popupStoreRepository;
    private final SearchService searchService;

    /** 미리보기 — 이름 완전일치 중복 그룹만(2건 이상). 적용 전에 무엇이 정리될지 확인용. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> previewDuplicates() {
        return findGroups().stream()
                .map(
                        group -> {
                            List<PopupStore> sorted = group.stream().sorted(KEEPER_ORDER).toList();
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("name", sorted.get(0).getName());
                            m.put("count", sorted.size());
                            m.put("keepId", sorted.get(0).getId());
                            m.put(
                                    "items",
                                    sorted.stream()
                                            .map(
                                                    p -> {
                                                        Map<String, Object> item =
                                                                new LinkedHashMap<>();
                                                        item.put("id", p.getId());
                                                        item.put("location", nz(p.getLocation()));
                                                        item.put(
                                                                "confidence",
                                                                p.getConfidenceScore());
                                                        return item;
                                                    })
                                            .toList());
                            return m;
                        })
                .toList();
    }

    /** 적용 — 각 중복 그룹에서 대표만 남기고 나머지 숨김 + Algolia 색인 제거. */
    @Transactional
    @Caching(
            evict = {
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_VISIBLE, allEntries = true),
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_HOT, allEntries = true)
            })
    public Map<String, Object> dedupe() {
        List<List<PopupStore>> groups = findGroups();
        int hidden = 0;
        for (List<PopupStore> group : groups) {
            List<PopupStore> sorted = group.stream().sorted(KEEPER_ORDER).toList();
            for (int i = 1; i < sorted.size(); i++) {
                PopupStore dup = sorted.get(i);
                dup.setReviewStatus(DUPLICATE_STATUS);
                popupStoreRepository.save(dup);
                searchService.removePopup(dup.getId());
                hidden++;
            }
        }
        log.info("[Dedup] 중복 그룹={} 숨김={}", groups.size(), hidden);
        return Map.of("groups", groups.size(), "hidden", hidden);
    }

    /** 이미 숨김(DUPLICATE) 처리된 것 제외하고, 이름 완전일치로 그룹핑해 2건 이상만 반환. */
    private List<List<PopupStore>> findGroups() {
        Map<String, List<PopupStore>> byName =
                popupStoreRepository.findAll().stream()
                        .filter(p -> p.getName() != null && !p.getName().isBlank())
                        .filter(p -> !DUPLICATE_STATUS.equals(p.getReviewStatus()))
                        .collect(
                                Collectors.groupingBy(
                                        p -> p.getName().trim(),
                                        LinkedHashMap::new,
                                        Collectors.toList()));
        return byName.values().stream().filter(group -> group.size() > 1).toList();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
