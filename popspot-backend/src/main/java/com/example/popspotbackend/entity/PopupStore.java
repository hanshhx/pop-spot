package com.example.popspotbackend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 팝업스토어 엔티티 — 수동 등록 / 사용자 제보 / 자동수집(crawled) 모두 같은 테이블에 저장한다.
 *
 * <p>자동수집 row 는 {@code sourceType=CRAWLED}, 원본 URL 표시, 외부 ID 해시로 중복 차단, LLM 신뢰도와 {@code
 * reviewStatus} 로 검수 / 게시 단계를 구분한다. Takedown 신고는 {@code reviewStatus=TAKEDOWN} 으로 즉시 노출 차단 후 admin
 * 이 처리한다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "popup_store")
public class PopupStore {

    private static final String MAIN_IMAGE_FLAG = "Y";
    private static final String FALLBACK_IMAGE_URL =
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2070&auto=format&fit=crop";

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "popup_store_generator")
    @SequenceGenerator(
            name = "popup_store_generator",
            sequenceName = "popup_store_seq",
            allocationSize = 1)
    @Column(name = "popup_id")
    private Long id;

    @Column(name = "api_popup_id")
    private String apiPopupId;

    @Column(name = "partner_id")
    private String partnerId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "address")
    private String location;

    @Column(name = "detail_address")
    private String address;

    @Column(name = "content", length = 2000)
    private String content;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "category")
    private String category;

    @Column(name = "start_date")
    private String startDate;

    @Column(name = "end_date")
    private String endDate;

    @Column(name = "is_active")
    private String isActive;

    @Column(name = "view_count", columnDefinition = "integer default 0")
    @Builder.Default
    private Integer viewCount = 0;

    @Column(name = "latitude")
    private String latitude;

    @Column(name = "longitude")
    private String longitude;

    @Column(name = "status")
    private String status;

    @Column(name = "reporter_id")
    private String reporterId;

    /** N+1 폭주 방지를 위해 LAZY 로딩. */
    @Builder.Default
    @OneToMany(fetch = FetchType.LAZY)
    @JoinColumn(name = "popup_id")
    private List<PopupImage> images = new ArrayList<>();

    /* ============================== V4 자동수집 / 검수 ============================== */

    /** MANUAL / CRAWLED / USER_REPORT. */
    @Column(name = "source_type", length = 20)
    private String sourceType;

    /** 원본 URL — 저작권법 출처 표시 의무 충족. */
    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "source_name", length = 100)
    private String sourceName;

    /** 중복 수집 방어용 SHA-256 (name + location + startDate). */
    @Column(name = "external_id", length = 64, unique = true)
    private String externalId;

    /** LLM 정규화 신뢰도 0.00 ~ 1.00. */
    @Column(name = "confidence_score", precision = 3, scale = 2)
    private BigDecimal confidenceScore;

    @Column(name = "crawled_at")
    private LocalDateTime crawledAt;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    /** AUTO_PUBLISHED / PENDING_REVIEW / APPROVED / REJECTED / TAKEDOWN. */
    @Column(name = "review_status", length = 20)
    private String reviewStatus;

    /*
     * takedown 3종은 직렬화하지 않는다.
     *
     * 이 엔티티는 GET /api/popups/{id} 에서 무인증으로 통째로 직렬화된다(PopupStoreController#getPopupById 가
     * result.put("data", popup) 로 넘긴다). 평소에는 takedown 필드가 붙은 행이 곧 reviewStatus=TAKEDOWN 이고
     * passesModerationGate 가 404 로 막아 노출되지 않지만, 그 안전은 설계가 아니라 우연이다 —
     * 악의적 신고로 판단해 admin 이 승인(PopupAdminReviewController#approve)하면 reviewStatus 만 APPROVED 로
     * 바뀌고 takedown 필드는 그대로 남는다. 그 순간 신고자 이메일이 공개 API 로 나간다.
     *
     * 권리침해를 신고한 사람은 신원이 드러나면 안 되는 쪽에 가깝다. 조회 경로가 하나 늘 때마다
     * 다시 검토해야 하는 구조를 없애기 위해, 노출 여부를 게이트가 아니라 필드에 고정한다.
     * admin 이 신고 내용을 봐야 한다면 전용 DTO 로 별도 노출한다(현재 이 필드들을 읽는 화면은 없다).
     */
    @JsonIgnore
    @Column(name = "takedown_requested_at")
    private LocalDateTime takedownRequestedAt;

    @JsonIgnore
    @Column(name = "takedown_reason", length = 500)
    private String takedownReason;

    @JsonIgnore
    @Column(name = "takedown_requester", length = 255)
    private String takedownRequester;

    /* ============================== 헬퍼 / 비즈니스 메서드 ============================== */

    /** 대표 이미지 URL. main flag 가 있는 row 를 우선하고, 없으면 첫 번째 이미지, 그것도 없으면 fallback. */
    public String getImageUrl() {
        if (images == null || images.isEmpty()) return FALLBACK_IMAGE_URL;
        return images.stream()
                .filter(img -> MAIN_IMAGE_FLAG.equals(img.getMainYn()))
                .findFirst()
                .map(PopupImage::getImageUrl)
                .orElse(images.get(0).getImageUrl());
    }

    /** 외부 API 가 보낸 Map 으로 필드를 부분 업데이트. null 값은 덮어쓰지 않는다. */
    public void updateAllDetails(Map<String, String> data) {
        if (data == null) return;
        applyIfPresent(data, "popup_id", v -> this.apiPopupId = v);
        applyIfPresent(data, "partner_id", v -> this.partnerId = v);
        applyIfPresent(data, "name", v -> this.name = v);
        applyIfPresent(data, "content", v -> this.content = v);
        applyIfPresent(data, "description", v -> this.description = v);
        applyIfPresent(data, "category", v -> this.category = v);
        applyIfPresent(data, "start_date", v -> this.startDate = v);
        applyIfPresent(data, "end_date", v -> this.endDate = v);
        applyIfPresent(data, "location", v -> this.location = v);
        applyIfPresent(data, "latitude", v -> this.latitude = v);
        applyIfPresent(data, "longitude", v -> this.longitude = v);
        applyIfPresent(data, "is_active", v -> this.isActive = v);
        applyIfPresent(data, "status", v -> this.status = v);
        applyIntIfPresent(data, "views", v -> this.viewCount = v);
    }

    public void updateDetails(String description, String startDate, String endDate) {
        this.description = description;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    private void applyIfPresent(
            Map<String, String> data, String key, java.util.function.Consumer<String> setter) {
        String value = data.get(key);
        if (value != null) setter.accept(value);
    }

    private void applyIntIfPresent(
            Map<String, String> data, String key, java.util.function.Consumer<Integer> setter) {
        String value = data.get(key);
        if (value == null) return;
        try {
            setter.accept(Integer.parseInt(value));
        } catch (NumberFormatException ignore) {
            // 정수 파싱 실패는 무시 (외부 데이터의 빈 문자열/문자 대응).
        }
    }
}
