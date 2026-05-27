package com.example.popspotbackend.service;

import com.example.popspotbackend.config.CacheConfig;
import com.example.popspotbackend.dto.CalendarPopupDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팝업스토어 공개 조회 / 검색 / 캘린더 / 상세.
 *
 * <p>공개 가능 여부({@link #isPublic}) 는 두 가지 축을 모두 본다: {@code status} (PENDING / EXPIRED 제외)와 {@code
 * reviewStatus} ({@code AUTO_PUBLISHED} / {@code APPROVED} 만 허용, 레거시 수동 데이터는 null 통과).
 *
 * <p>v2.20.1 — findVisibleMapMarkers 에 Cacheable 적용 (컨트롤러가 DTO 로 매핑하므로 lazy 위험 없음). 쓰기(저장 / 삭제 /
 * 검수상태 변경) 는 CacheEvict 로 두 캐시(visible / hot) 를 즉시 비운다. 부수효과 있는 getPopupById (viewCount++) / lazy
 * 필드 직접 직렬화하는 getTrendingPopups 는 v2.21 대상.
 */
@Service
@RequiredArgsConstructor
public class PopupStoreService {

    private static final String CATEGORY_ALL = "ALL";

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_EXPIRED = "EXPIRED";

    private static final String REVIEW_AUTO_PUBLISHED = "AUTO_PUBLISHED";
    private static final String REVIEW_APPROVED = "APPROVED";

    private static final int TRENDING_TOP_N = 4;
    private static final int DEFAULT_CALENDAR_WINDOW_DAYS = 60;

    private final PopupStoreRepository popupStoreRepository;

    /**
     * v2.21-S3 — 자동수집 팝업 최소 신뢰도 (사용자 화면 노출 기준). 운영 중 application.properties
     * 에서 조정 가능. 미만은 검수 큐만 진입하고 지도/BROWSE/검색 결과에 노출되지 않는다.
     *
     * <p>{@code popspot.popup.min-visible-confidence} (기본 0.80)
     *
     * <p>자동수집 시 {@code popspot.crawler.confidence-threshold} 와는 별개. 그건 자동게시 vs
     * 검수큐 분기용, 이건 검수 통과 / 레거시 데이터까지 포함해 "신뢰도 낮은 수집 row 는 영원히
     * 안 보이게" 차단하는 최후의 게이트.
     */
    @Value("${popspot.popup.min-visible-confidence:0.80}")
    private BigDecimal minVisibleConfidence;

    /** id 로 팝업 조회 → 없으면 404. */
    public PopupStore findOrThrow(Long id) {
        return popupStoreRepository
                .findById(id)
                .orElseThrow(() -> ResourceNotFoundException.popup(id));
    }

    /** 저장 (takedown / report 후속 처리에서 컨트롤러가 호출하지 않도록 위임). */
    @Transactional
    @Caching(
            evict = {
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_VISIBLE, allEntries = true),
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_HOT, allEntries = true)
            })
    public PopupStore save(PopupStore popup) {
        return popupStoreRepository.save(popup);
    }

    /** 전체 팝업 (필터 없음). admin / 굿즈 매핑 같은 부가 화면에서만 사용. */
    @Transactional(readOnly = true)
    public List<PopupStore> findAll() {
        return popupStoreRepository.findAll();
    }

    /** 자동수집 검수 대기 큐 (신뢰도 < 임계값). */
    @Transactional(readOnly = true)
    public List<PopupStore> findPendingReview(int pageSize) {
        return popupStoreRepository.findPendingReview(PageRequest.of(0, pageSize));
    }

    /** 검수 결과로 reviewStatus 갱신 후 저장. */
    @Transactional
    @Caching(
            evict = {
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_VISIBLE, allEntries = true),
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_HOT, allEntries = true)
            })
    public PopupStore updateReviewStatus(Long id, String reviewStatus) {
        PopupStore popup = findOrThrow(id);
        popup.setReviewStatus(reviewStatus);
        return popupStoreRepository.save(popup);
    }

    /** Takedown 검토 완료 후 영구 삭제. */
    @Transactional
    @Caching(
            evict = {
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_VISIBLE, allEntries = true),
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_HOT, allEntries = true)
            })
    public void deleteById(Long id) {
        PopupStore popup = findOrThrow(id);
        popupStoreRepository.delete(popup);
    }

    /**
     * v2.21-S3 — 자동수집 cron 완료 후 명시적 캐시 무효화. PopupCrawlOrchestrator 가
     * Repository.save() 를 직접 호출 (Service.save 우회) 하기 때문에 @CacheEvict 가 안 걸리는
     * 회귀를 보강. 5분 TTL 만료까지 기다리지 않고 즉시 BROWSE / 지도가 새 수집 결과 반영.
     */
    @Caching(
            evict = {
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_VISIBLE, allEntries = true),
                @CacheEvict(value = CacheConfig.CACHE_POPUPS_HOT, allEntries = true)
            })
    public void evictPopupCaches() {
        // annotation 효과만 활용 — body 비워둠.
    }

    /**
     * 지도 마커용 팝업 목록 (PENDING 제외).
     *
     * <p>v2.9: 메모리 필터 → SQL WHERE 절({@link PopupStoreRepository#findAllVisible}).
     *
     * <p>v2.20.1: 5분 캐시. 어드민 쓰기 시 즉시 invalidate.
     */
    @Transactional(readOnly = true)
    @Cacheable(value = CacheConfig.CACHE_POPUPS_VISIBLE, sync = true)
    public List<PopupStore> findVisibleMapMarkers() {
        // v2.21-S2 — isPublic 필터 추가. 신뢰도 0.8 미만 자동수집 row 가 지도/BROWSE 에 노출되던
        // 회귀를 차단. 캐시는 필터 후 결과를 그대로 보관 (5분 TTL).
        return popupStoreRepository.findAllVisible().stream().filter(this::isPublic).toList();
    }

    /** 카테고리 필터링이 들어오면 해당 카테고리만, 아니면 전체 공개 팝업. */
    public List<PopupStore> getAllPopups(String category) {
        List<PopupStore> popups =
                isAllCategory(category)
                        ? popupStoreRepository.findAllPublic()
                        : popupStoreRepository.findByCategory(category.toUpperCase());
        return popups.stream().filter(this::isPublic).toList();
    }

    /** 키워드가 이름 / 위치에 포함된 팝업 (공개 가능한 것만). */
    public List<PopupStore> searchPopups(String keyword) {
        return popupStoreRepository
                .findByNameContainingOrLocationContaining(keyword, keyword)
                .stream()
                .filter(this::isPublic)
                .toList();
    }

    /**
     * 인기 팝업 Top {@value #TRENDING_TOP_N}. DB 단에서 정렬 + LIMIT 으로 성능 보장.
     *
     * <p>v2.20.1: 엔티티를 컨트롤러로 직접 반환 → Jackson 직렬화 시 lazy images 필드 접근. 캐시 hit 시 detached 엔티티가 되어
     * LazyInitializationException 위험. DTO 변환 후 캐싱하도록 v2.21 에서 리팩터 필요. 현재는 findVisibleMapMarkers 만
     * 캐시.
     */
    @Transactional(readOnly = true)
    public List<PopupStore> getTrendingPopups() {
        return popupStoreRepository.findTrendingPublic(PageRequest.of(0, TRENDING_TOP_N));
    }

    /** 상세 페이지 진입 시 viewCount 1 증가 후 반환. */
    @Transactional
    public PopupStore getPopupById(Long id) {
        PopupStore popup =
                popupStoreRepository
                        .findById(id)
                        .orElseThrow(() -> ResourceNotFoundException.popup(id));
        int currentViews = popup.getViewCount() != null ? popup.getViewCount() : 0;
        popup.setViewCount(currentViews + 1);
        return popup;
    }

    /** 캘린더 — 행사 기간이 [from, to] 와 겹치는 공개 팝업. 파라미터 생략 시 오늘 ~ 60일 후. */
    @Transactional(readOnly = true)
    public List<CalendarPopupDto> getCalendar(String fromDate, String toDate) {
        LocalDate from = parseOrDefault(fromDate, LocalDate.now());
        LocalDate to = parseOrDefault(toDate, from.plusDays(DEFAULT_CALENDAR_WINDOW_DAYS));
        if (to.isBefore(from)) to = from.plusDays(DEFAULT_CALENDAR_WINDOW_DAYS);

        return popupStoreRepository
                .findCalendarRange(
                        from.format(DateTimeFormatter.ISO_LOCAL_DATE),
                        to.format(DateTimeFormatter.ISO_LOCAL_DATE))
                .stream()
                .filter(this::isPublic)
                .map(CalendarPopupDto::fromEntity)
                .toList();
    }

    /* ============================== 내부 헬퍼 ============================== */

    private boolean isAllCategory(String category) {
        return category == null || category.isEmpty() || CATEGORY_ALL.equalsIgnoreCase(category);
    }

    private boolean isPublic(PopupStore p) {
        if (isHiddenStatus(p.getStatus())) return false;
        String rs = p.getReviewStatus();
        if (rs != null && !REVIEW_AUTO_PUBLISHED.equals(rs) && !REVIEW_APPROVED.equals(rs)) {
            return false;
        }
        // v2.21-S2/S3 — 자동수집 신뢰도 미만 차단. null (수동 입력 / 레거시) 은 통과.
        // 임계값은 popspot.popup.min-visible-confidence 환경변수로 운영 중 조정 가능.
        BigDecimal confidence = p.getConfidenceScore();
        if (confidence != null && confidence.compareTo(minVisibleConfidence) < 0) {
            return false;
        }
        return true;
    }

    private boolean isHiddenStatus(String status) {
        return STATUS_PENDING.equals(status) || STATUS_EXPIRED.equals(status);
    }

    private LocalDate parseOrDefault(String iso, LocalDate fallback) {
        if (iso == null || iso.isBlank()) return fallback;
        try {
            return LocalDate.parse(iso, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (Exception e) {
            return fallback;
        }
    }
}
