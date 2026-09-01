package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.PopupStore;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 무인증 공개 상세({@code GET /api/popups/{id}}) 응답 DTO.
 *
 * <p><b>왜 필요한가.</b> 지금까지 상세는 {@code result.put("data", popup)} 로 엔티티를 통째로 내보냈다. 그래서 엔티티에 필드를 하나
 * 추가하면 그 순간 무인증 공개 API 의 스펙이 같이 늘어났다 — 아무도 그런 의도로 필드를 넣지 않는데도. 노출을 게이트가 아니라 화이트리스트로 고정한다.
 *
 * <p><b>뺀 필드.</b> crawledAt / lastSeenAt 원본 / confidenceScore / reviewStatus / externalId /
 * reporterId / partnerId / apiPopupId / isActive. 전부 수집·검수용 내부 값이고, 프론트 상세 화면 ({@code
 * app/popup/[id]/page.tsx})에서 화면에 그려지는 곳이 없다({@code reviewStatus} 는 state 에 담기기만 하고 렌더에 쓰이지 않는다).
 *
 * <p><b>{@code images} 는 뺀 필드였다가 들어왔다.</b> 뺀 이유가 "화면에 그려지는 곳이 없다" 였고, 이제 그리는 곳이 생겼다 — 주최측이 보내온
 * 포스터·카드뉴스를 소개 아래 갤러리에 붙인다. 다만 엔티티의 원본 배열이 아니라 {@link PopupGalleryImageDto} 로 한 겹 걸러서 내보낸다. 화이트리스트의
 * 규칙은 여전히 <b>그리는 것만, 그리는 데 필요한 만큼만</b> 이다.
 *
 * <p><b>sourceUrl / sourceName 은 남긴다.</b> 목록에서는 뺐지만 상세에서는 유지한다. (1) 이용약관 §10-2 가 "자동수집 정보에는 항상 원본
 * 출처 링크가 함께 표시되며, 상세페이지에서 이용자가 원문으로 이동할 수 있도록 출처 링크를 제공한다" 고 공표돼 있고, (2) 상세 화면의 'AI 자동수집 정보' 블록이
 * {@code sourceName} 문구와 '원문 출처 보기' 링크를 실제로 렌더한다. 여기서 빼면 화면 요소가 사라지고 저작권법 제37조(출처명시) 이행 근거도 함께
 * 사라진다. 대량 유출 위험은 "요청 한 번에 전건" 인 목록 쪽이었고 그쪽은 {@link PopupPublicListDto} 가 막는다.
 */
@Data
@Builder
public class PopupPublicDetailDto {

    private Long id;
    private String name;
    private String location;
    private String nameEn;
    private String nameJa;
    private String locationEn;
    private String locationJa;

    /** 상세 주소. 프론트가 {@code location} 이 비면 이 값으로 폴백한다. */
    private String address;

    private String category;
    private String status;
    private String startDate;
    private String endDate;
    private String description;
    private String content;
    private String latitude;
    private String longitude;
    private Integer viewCount;

    private String imageUrl;
    private String photoOrigin;
    private String photoSourceUrl;
    private String photoCreditName;
    private String photoCreditUrl;

    /**
     * 소개 아래 갤러리에 그릴 사진들 — <b>대표가 아닌 실사진만.</b> 없으면 빈 배열이고, 오늘 살아 있는 팝업은 전부 여기에 해당한다. 선별 규칙과 그 이유는
     * {@link PopupGalleryImageDto#galleryOf}.
     */
    private List<PopupGalleryImageDto> images;

    /** MANUAL / CRAWLED / USER_REPORT — 'AI 자동수집 정보' 고지 블록의 노출 조건. */
    private String sourceType;

    /** 출처 제공자명 — 고지 문구에 그대로 들어간다(약관 §10-2). */
    private String sourceName;

    /** 원문 링크 — 상세의 '원문 출처 보기' 버튼(약관 §10-2 / 저작권법 §37). */
    private String sourceUrl;

    /** 팝업 공식 사이트 · 예약 링크. 상세 하단 CTA 가 값이 있을 때만 노출한다. */
    private String officialUrl;

    private String reservationUrl;

    /** 자동수집 원문을 마지막으로 다시 확인한 시각. 내부 수집 이력은 숨기고 사용자에게 필요한 한 시각만 보낸다. */
    private LocalDateTime informationCheckedAt;

    public static PopupPublicDetailDto fromEntity(PopupStore p) {
        return PopupPublicDetailDto.builder()
                .id(p.getId())
                .name(p.getName())
                .location(p.getLocation())
                .nameEn(p.getNameEn())
                .nameJa(p.getNameJa())
                .locationEn(p.getLocationEn())
                .locationJa(p.getLocationJa())
                .address(p.getAddress())
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
                .images(PopupGalleryImageDto.galleryOf(p))
                .sourceType(p.getSourceType())
                .sourceName(p.getSourceName())
                .sourceUrl(p.getSourceUrl())
                .officialUrl(p.getOfficialUrl())
                .reservationUrl(p.getReservationUrl())
                .informationCheckedAt(informationCheckedAt(p))
                .build();
    }

    private static LocalDateTime informationCheckedAt(PopupStore popup) {
        if (!"CRAWLED".equalsIgnoreCase(popup.getSourceType())) {
            return null;
        }
        return popup.getLastSeenAt() != null ? popup.getLastSeenAt() : popup.getCrawledAt();
    }
}
