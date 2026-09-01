package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.PopupImage;
import com.example.popspotbackend.entity.PopupStore;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import lombok.Builder;
import lombok.Data;

/**
 * 상세 화면 '제공 자료' 갤러리에 그리는 사진 한 장.
 *
 * <p><b>왜 지금 생겼나.</b> {@link PopupPublicDetailDto} 는 {@code images} 원본 배열을 "수집·검수용 내부 값이고 화면에 그려지는
 * 곳이 없다" 는 이유로 뺐다. 이제 그리는 곳이 생겼다 — 주최측이 보내온 포스터·카드뉴스를 소개 아래에 붙인다. 화이트리스트의 규칙은 <b>그리는 것만 내보낸다</b>
 * 이므로, 그리기로 한 이상 넣는 것이 규칙을 지키는 쪽이다.
 *
 * <p><b>내보내는 것은 그리는 데 필요한 다섯 개뿐이다.</b> 엔티티의 {@code id} 와 {@code pexelsPhotoId} 는 뺀다 — 화면이 쓰지 않고,
 * Pexels 사진 ID 는 우리가 어떤 스톡을 어디에 배정했는지를 통째로 드러내는 내부 값이다.
 */
@Data
@Builder
public class PopupGalleryImageDto {

    /**
     * 갤러리에 올릴 수 있는 사진의 출처.
     *
     * <p><b>스톡(PEXELS)과 플레이스홀더는 못 들어온다.</b> 갤러리는 "이 팝업의 사진" 이라는 뜻으로 읽힌다. 살아 있는 팝업 1,405건이 전부 PEXELS
     * 아니면 PLACEHOLDER 인데, 그것을 여러 장 늘어놓으면 <b>실제 현장 사진을 여러 장 확보한 것처럼</b> 보인다. 히어로 한 장은 '연출 이미지' 고지를
     * 달고 나가지만, 갤러리에는 그 고지가 붙어도 "여러 장이나 있다" 는 인상 자체가 거짓이 된다.
     */
    private static final Set<String> REAL_ORIGINS =
            Set.of(PopupImage.ORIGIN_CRAWLED, PopupImage.ORIGIN_USER);

    private String imageUrl;

    /** CRAWLED / USER. 화면이 출처 문구를 고르는 데 쓴다. */
    private String photoOrigin;

    private String photoCreditName;
    private String photoCreditUrl;

    /** 원본이 있는 사진의 출처 링크(저작권법 §37 출처명시). */
    private String photoSourceUrl;

    /**
     * 이 팝업의 갤러리 — <b>대표가 아닌 실사진만, 넣은 순서대로.</b>
     *
     * <p><b>순서가 왜 중요한가.</b> 카드뉴스는 낱장이 아니라 <b>차례가 있는 한 벌</b>이다. 3번 장이 1번 앞에 오면 읽는 순서가 무너진다.
     * {@code @OneToMany} 는 순서를 보장하지 않으므로(SQL 은 {@code ORDER BY} 없이는 순서를 약속하지 않는다) 여기서 못 박는다. 정렬 기준은
     * {@code id} — 넣은 차례가 곧 읽는 차례다.
     *
     * <p>아직 저장 안 된 엔티티는 {@code id} 가 {@code null} 이라 뒤로 보낸다. {@link List#sort} 는 안정 정렬이라 같은 값끼리는 원래
     * 순서를 지킨다.
     *
     * <p><b>대표 이미지도 뺀 목록이 아니다 — 전부 담는다.</b> 처음에는 "히어로가 이미 그리니까" 빼 뒀는데, 그러면 대표로 올린 포스터를 <b>어디에서도 온전히
     * 볼 수 없다.</b> 히어로는 가로로 잘리기 때문이다(세로 포스터를 가로 띠에 넣으면 피할 수 없다). 그 한 장이 보통 가장 정보가 많은 장이라, 잘린 채로만
     * 존재하게 되는 것은 손해가 크다. 히어로와 첫 장이 겹치지만 그 겹침은 표지가 자료의 일부인 것과 같다.
     *
     * <p><b>오늘 이 메서드는 모든 팝업에 빈 목록을 준다</b> — 1,405건이 전부 PEXELS·PLACEHOLDER 라 출처 검사에서 걸린다. 즉 이 변경으로
     * 기존 화면은 한 곳도 바뀌지 않는다. 주최측 자료가 들어온 팝업에서만 갤러리가 생긴다.
     */
    public static List<PopupGalleryImageDto> galleryOf(PopupStore popup) {
        if (popup == null || popup.getImages() == null) return List.of();
        return popup.getImages().stream()
                .filter(PopupGalleryImageDto::isGalleryImage)
                .sorted(
                        Comparator.comparing(
                                PopupImage::getId, Comparator.nullsLast(Long::compare)))
                .map(PopupGalleryImageDto::fromEntity)
                .toList();
    }

    private static boolean isGalleryImage(PopupImage image) {
        if (image == null) return false;
        if (image.getImageUrl() == null || image.getImageUrl().isBlank()) return false;
        String origin = image.getPhotoOrigin();
        return origin != null && REAL_ORIGINS.contains(origin.toUpperCase());
    }

    private static PopupGalleryImageDto fromEntity(PopupImage image) {
        return PopupGalleryImageDto.builder()
                .imageUrl(image.getImageUrl())
                .photoOrigin(image.getPhotoOrigin())
                .photoCreditName(image.getPhotoCreditName())
                .photoCreditUrl(image.getPhotoCreditUrl())
                .photoSourceUrl(image.getPhotoSourceUrl())
                .build();
    }
}
