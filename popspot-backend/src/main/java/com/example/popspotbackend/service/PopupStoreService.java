package com.example.popspotbackend.service;

import com.example.popspotbackend.config.CacheConfig;
import com.example.popspotbackend.dto.CalendarPopupDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
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

    /*
     * v2.21-S4 — 사용자 화면 노출 신뢰도 게이트 제거 (운영자 결정).
     *
     * 이유: 자동수집 시점의 popspot.crawler.confidence-threshold 가 이미 자동게시 vs 검수큐
     * 분기를 처리하므로 추가 게이트가 핀 누락만 일으킴. 운영자가 검수 통과시킨 데이터는
     * 신뢰도와 무관하게 노출되어야 함. v2.21-S2/S3 의 minVisibleConfidence 필드 + 키
     * (popspot.popup.min-visible-confidence) 모두 제거.
     */

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
     * v2.21-S3 — 자동수집 cron 완료 후 명시적 캐시 무효화. PopupCrawlOrchestrator 가 Repository.save() 를 직접 호출
     * (Service.save 우회) 하기 때문에 @CacheEvict 가 안 걸리는 회귀를 보강. 5분 TTL 만료까지 기다리지 않고 즉시 BROWSE / 지도가 새 수집
     * 결과 반영.
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

    /**
     * 상세 페이지 진입 시 viewCount 1 증가 후 반환.
     *
     * <p>검수 상태 게이트를 통과한 것만 반환한다. 이전에는 {@code findById} 결과를 무검증 반환해서, 목록에서 숨긴 TAKEDOWN / REJECTED /
     * PENDING_REVIEW 팝업도 URL 로 직접 열면 그대로 보였다 — 권리자 신고로 내린 팝업이 링크만 알면 계속 열람되는 상태였고(약관 §11 위반), 조회수까지
     * 올라갔다.
     *
     * <p>존재 자체를 숨기기 위해 403 이 아니라 404 를 낸다.
     *
     * <p>종료일 경과는 여기서 막지 않는다. 위시리스트·방문기록·코스에 담아둔 팝업을 나중에 열어보는 것은 정상 사용이고, "이미 끝난 팝업" 이라는 사실은 화면이
     * 종료일로 표시하면 된다. 목록 노출만 막으면 된다.
     */
    @Transactional
    public PopupStore getPopupById(Long id) {
        PopupStore popup = findOrThrow(id);
        if (!passesModerationGate(popup)) throw ResourceNotFoundException.popup(id);
        int currentViews = popup.getViewCount() != null ? popup.getViewCount() : 0;
        popup.setViewCount(currentViews + 1);
        return popup;
    }

    /** 캘린더 — 행사 기간이 [from, to] 와 겹치는 공개 팝업. 파라미터 생략 시 오늘 ~ 60일 후. */
    @Transactional(readOnly = true)
    public List<CalendarPopupDto> getCalendar(String fromDate, String toDate) {
        // KST 명시. 같은 메서드의 isPublic 은 KST 기준인데 기본 조회 구간만 JVM 기본 TZ(운영 UTC)를 쓰면
        // 한국 새벽 시간대에 창이 하루 앞당겨져 두 판정이 어긋난다.
        LocalDate from = parseOrDefault(fromDate, LocalDate.now(PopupStoreRepository.SEOUL));
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

    /** 목록 노출 가능 여부 = 검수 게이트 + 종료 여부(상태·날짜 양쪽). */
    private boolean isPublic(PopupStore p) {
        return passesModerationGate(p) && !isEnded(p);
    }

    /**
     * 검수·상태 게이트. <b>종료 여부는 보지 않는다.</b>
     *
     * <p>목록({@link #isPublic})과 상세 진입이 공유한다. 상세는 이미 끝난 팝업이라도 열어준다 — 위시리스트나 방문기록에서 다시 열어보는 것은 정상
     * 사용이고, 끝났다는 사실은 화면이 종료일로 알리면 된다. 반면 TAKEDOWN / REJECTED / 미검수는 어느 경로로도 보이면 안 된다.
     */
    private boolean passesModerationGate(PopupStore p) {
        if (STATUS_PENDING.equals(p.getStatus())) return false;
        String rs = p.getReviewStatus();
        if (rs == null) return true;
        return REVIEW_AUTO_PUBLISHED.equals(rs) || REVIEW_APPROVED.equals(rs);
    }

    /** 스케줄러가 찍은 상태와 실제 날짜 중 하나라도 종료면 종료. */
    private boolean isEnded(PopupStore p) {
        return STATUS_EXPIRED.equals(p.getStatus()) || isPastEnd(p.getEndDate());
    }

    /**
     * 종료일이 이미 지났는가.
     *
     * <p>{@code status=EXPIRED} 전환은 하루 1회 스케줄러가 하므로 그것이 지연·실패하면 끝난 팝업이 계속 공개된다. 이 메서드는 {@code
     * findAllVisible} · 카테고리 · 검색 · 캘린더처럼 자체 쿼리를 쓰는 경로를 덮는다(리포지토리 쿼리에 조건을 넣은 경로와 함께 이중 차단).
     *
     * <p>ISO(YYYY-MM-DD) 문자열이라 사전식 비교가 곧 날짜 비교다. 값이 없거나 형식이 다르면 false — 날짜 미상일 뿐 종료 근거가 아니므로 추측해서
     * 숨기지 않는다.
     */
    private boolean isPastEnd(String endDate) {
        if (endDate == null || endDate.isBlank()) return false;
        return endDate.compareTo(PopupStoreRepository.todayKst()) < 0;
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
