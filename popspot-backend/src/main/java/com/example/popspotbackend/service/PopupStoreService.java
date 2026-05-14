package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.CalendarPopupDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팝업스토어 공개 조회 / 검색 / 캘린더 / 상세.
 *
 * <p>공개 가능 여부({@link #isPublic}) 는 두 가지 축을 모두 본다: {@code status} (PENDING / EXPIRED 제외)와 {@code
 * reviewStatus} ({@code AUTO_PUBLISHED} / {@code APPROVED} 만 허용, 레거시 수동 데이터는 null 통과).
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

    /** 인기 팝업 Top {@value #TRENDING_TOP_N}. DB 단에서 정렬 + LIMIT 으로 성능 보장. */
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
                        .orElseThrow(() -> new RuntimeException("팝업을 찾을 수 없습니다. ID: " + id));
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
        if (rs == null) return true;
        return REVIEW_AUTO_PUBLISHED.equals(rs) || REVIEW_APPROVED.equals(rs);
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
