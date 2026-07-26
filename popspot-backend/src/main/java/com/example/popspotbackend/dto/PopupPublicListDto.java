package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.PopupStore;
import lombok.Builder;
import lombok.Data;

/**
 * 무인증 공개 목록({@code GET /api/popups}, {@code /trending}, {@code /search}) 응답 DTO.
 *
 * <p><b>왜 엔티티 직렬화를 멈췄나.</b> 목록은 한 번의 요청으로 1,000건 이상을 통째로 내보낸다. 엔티티를 그대로 직렬화하면 {@code sourceUrl}(어느
 * 블로그·기사를 수집했는지) 이 전건 실려 나가, 권리자에게는 침해 목록을, 경쟁사에는 데이터셋 사본을 명령 한 줄로 넘겨주는 셈이 된다. 검수용 내부 값({@code
 * confidenceScore} / {@code reviewStatus} / {@code externalId})과 제보자·파트너 식별자도 공개할 이유가 없다. 필드를 하나
 * 추가할 때마다 공개 스펙이 조용히 늘어나던 구조를, 화이트리스트로 뒤집는다.
 *
 * <p><b>뺀 필드.</b> sourceUrl / sourceName / crawledAt / lastSeenAt / confidenceScore / reviewStatus
 * / externalId / reporterId / partnerId / apiPopupId / isActive / officialUrl / reservationUrl /
 * images 원본 배열. 프론트(popspot-frontend {@code src/types/popup.ts}, {@code lib/popupCover.ts})에서 목록이
 * 실제로 읽는 필드에는 하나도 들어 있지 않다.
 *
 * <p><b>남긴 필드의 근거.</b> {@code photoOrigin} / {@code photoSourceUrl} / {@code photoCreditName} /
 * {@code photoCreditUrl} 은 스톡(Pexels) 사진의 연출 고지·크레딧을 화면에 띄우는 데 쓰이고(popupCover.ts,
 * PhotoDisclosure.tsx), {@code sourceType} 은 "AI 자동수집" 뱃지의 조건이다. {@code content} 는 모바일 앱
 * (popspot-app)이 목록 항목을 그대로 상세 화면으로 넘겨 본문으로 쓰기 때문에 남긴다.
 *
 * <p>원본 URL 표시(약관 §10-2)는 <b>상세</b>에서 지킨다 — {@link PopupPublicDetailDto} 참고.
 */
@Data
@Builder
public class PopupPublicListDto {

    private Long id;
    private String name;
    private String location;
    private String category;
    private String status;
    private String startDate;
    private String endDate;
    private String description;
    private String content;
    private String latitude;
    private String longitude;
    private Integer viewCount;

    /** 대표 이미지 URL. 엔티티 getter 가 main flag → 첫 이미지 → 폴백 순으로 골라 준다. */
    private String imageUrl;

    /** CRAWLED / USER / PEXELS / PLACEHOLDER — 프론트가 실사진과 스톡을 구분하는 기준. */
    private String photoOrigin;

    private String photoSourceUrl;
    private String photoCreditName;
    private String photoCreditUrl;

    /** MANUAL / CRAWLED / USER_REPORT — "AI 자동수집" 뱃지 조건. 출처 URL 은 여기 싣지 않는다. */
    private String sourceType;

    public static PopupPublicListDto fromEntity(PopupStore p) {
        return PopupPublicListDto.builder()
                .id(p.getId())
                .name(p.getName())
                .location(p.getLocation())
                .category(p.getCategory())
                .status(p.getStatus())
                .startDate(p.getStartDate())
                .endDate(p.getEndDate())
                .description(p.getDescription())
                .content(p.getContent())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .viewCount(p.getViewCount())
                .imageUrl(p.getImageUrl())
                .photoOrigin(p.getPhotoOrigin())
                .photoSourceUrl(p.getPhotoSourceUrl())
                .photoCreditName(p.getPhotoCreditName())
                .photoCreditUrl(p.getPhotoCreditUrl())
                .sourceType(p.getSourceType())
                .build();
    }
}
