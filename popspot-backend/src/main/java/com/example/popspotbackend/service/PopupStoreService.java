package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.CalendarPopupDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PopupStoreService {

    private final PopupStoreRepository popupStoreRepository;

    /**
     * [로직 해석] 팝업스토어 전체 또는 카테고리별 목록을 조회하는 핵심 로직입니다.
     * 컨트롤러에서 'category' 값을 받아와서 판단합니다.
     * * @param category 사용자가 선택한 카테고리 (예: "FASHION", "FOOD", "ALL" 또는 null)
     * @return 조건에 맞는 팝업스토어 리스트
     */
    public List<PopupStore> getAllPopups(String category) {
        List<PopupStore> allPopups;

        // 1. 카테고리 값이 아예 없거나(null), 빈 문자열("")이거나, "ALL"이라고 요청한 경우
        if (category == null || category.isEmpty() || "ALL".equalsIgnoreCase(category)) {
            // [V4] PENDING/EXPIRED + PENDING_REVIEW/REJECTED/TAKEDOWN 모두 한 번에 거르는 통합 필터.
            allPopups = popupStoreRepository.findAllPublic();
        } else {
            // 2. 특정 카테고리(예: "FASHION")가 넘어온 경우
            allPopups = popupStoreRepository.findByCategory(category.toUpperCase());
        }

        // 🔥 [추가 필터링] PENDING/EXPIRED + 검수 미통과/takedown 모두 거름.
        return allPopups.stream()
                .filter(this::isPublic)
                .collect(Collectors.toList());
    }

    /**
     * 캘린더 — 시작일이 from~to 사이거나, 행사 기간이 from~to 와 겹치는 팝업.
     * fromDate/toDate 는 ISO YYYY-MM-DD.
     */
    @Transactional(readOnly = true)
    public List<CalendarPopupDto> getCalendar(String fromDate, String toDate) {
        // 안전 — 파라미터 없으면 오늘 ~ 60일 후
        LocalDate from = parseOrDefault(fromDate, LocalDate.now());
        LocalDate to   = parseOrDefault(toDate,   from.plusDays(60));
        if (to.isBefore(from)) to = from.plusDays(60);

        List<PopupStore> popups = popupStoreRepository.findCalendarRange(
                from.format(DateTimeFormatter.ISO_LOCAL_DATE),
                to.format(DateTimeFormatter.ISO_LOCAL_DATE)
        );
        return popups.stream()
                .filter(this::isPublic)
                .map(CalendarPopupDto::fromEntity)
                .collect(Collectors.toList());
    }

    /** 공개 가능 여부 통합 판정 */
    private boolean isPublic(PopupStore p) {
        if (p.getStatus() != null && (p.getStatus().equals("PENDING") || p.getStatus().equals("EXPIRED"))) {
            return false;
        }
        String rs = p.getReviewStatus();
        if (rs == null) return true;     // legacy manual 데이터
        return rs.equals("AUTO_PUBLISHED") || rs.equals("APPROVED");
    }

    private LocalDate parseOrDefault(String iso, LocalDate fallback) {
        if (iso == null || iso.isBlank()) return fallback;
        try { return LocalDate.parse(iso, DateTimeFormatter.ISO_LOCAL_DATE); }
        catch (Exception e) { return fallback; }
    }

    /**
     * [로직 해석] 특정 ID를 가진 팝업스토어 1개의 상세 정보를 가져옵니다.
     * 상세 페이지(Detail Page)에서 사용됩니다.
     */
    // 🔥 [수정됨] 상세 페이지 들어올 때마다 조회수(viewCount) +1 증가 로직 및 @Transactional 추가
    @Transactional
    public PopupStore getPopupById(Long id) {
        PopupStore popup = popupStoreRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("팝업을 찾을 수 없습니다. ID: " + id));

        // 조회수 1 증가 (null 방어)
        int currentViews = popup.getViewCount() != null ? popup.getViewCount() : 0;
        popup.setViewCount(currentViews + 1);

        return popup;
    }

    /**
     * [로직 해석] 조회수(viewCount)가 가장 높은 상위 4개를 뽑아오는 로직입니다.
     * 메인 페이지의 '인기 팝업' 섹션에서 사용됩니다.
     * @Transactional(readOnly = true): 읽기 전용 트랜잭션을 걸어 성능을 최적화합니다.
     */
    @Transactional(readOnly = true)
    public List<PopupStore> getTrendingPopups() {
        // 🔥 [성능 개선] 메모리에서 필터/정렬 X. DB 단에서 정렬 + LIMIT.
        // [V4] EXPIRED + PENDING_REVIEW/REJECTED/TAKEDOWN 모두 거른 public 트렌딩.
        return popupStoreRepository.findTrendingPublic(PageRequest.of(0, 4));
    }

    public List<PopupStore> searchPopups(String keyword) {
        // 🔥 [추가 필터링] 검색 결과에서도 비공개 상태 모두 제거.
        return popupStoreRepository.findByNameContainingOrLocationContaining(keyword, keyword).stream()
                .filter(this::isPublic)
                .collect(Collectors.toList());
    }
}