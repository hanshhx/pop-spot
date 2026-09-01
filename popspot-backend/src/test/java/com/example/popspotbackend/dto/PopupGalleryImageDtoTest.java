package com.example.popspotbackend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.entity.PopupImage;
import com.example.popspotbackend.entity.PopupStore;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 갤러리 선별 규칙.
 *
 * <p>이 판정이 느슨하면 <b>스톡 사진 여러 장이 실제 현장 사진처럼</b> 깔린다 — 살아 있는 팝업 1,405건이 전부 스톡이라 사이트 전체가 한 번에 거짓말을 한다.
 * 빡빡하면 정작 주최측이 보내온 자료가 화면에 안 나와, 등록해 놓고 안 보이는 상태가 된다.
 */
class PopupGalleryImageDtoTest {

    private static PopupImage image(Long id, String url, String origin, String mainYn) {
        PopupImage img = new PopupImage();
        img.setId(id);
        img.setImageUrl(url);
        img.setPhotoOrigin(origin);
        img.setMainYn(mainYn);
        return img;
    }

    private static PopupStore popupWith(PopupImage... images) {
        PopupStore popup = new PopupStore();
        popup.setImages(new ArrayList<>(List.of(images)));
        return popup;
    }

    @Test
    @DisplayName("주최측이 보낸 사진은 갤러리에 들어간다")
    void includesProvidedRealPhotos() {
        PopupStore popup =
                popupWith(
                        image(1L, "/partner/jeju-01.webp", PopupImage.ORIGIN_USER, "N"),
                        image(2L, "/partner/jeju-02.webp", PopupImage.ORIGIN_USER, "N"));

        assertThat(PopupGalleryImageDto.galleryOf(popup))
                .extracting(PopupGalleryImageDto::getImageUrl)
                .containsExactly("/partner/jeju-01.webp", "/partner/jeju-02.webp");
    }

    @Test
    @DisplayName("원문에서 가져온 실사진도 갤러리에 들어간다")
    void includesCrawledRealPhotos() {
        PopupStore popup = popupWith(image(1L, "https://x/a.jpg", PopupImage.ORIGIN_CRAWLED, "N"));

        assertThat(PopupGalleryImageDto.galleryOf(popup)).hasSize(1);
    }

    /*
     * 카드뉴스는 낱장이 아니라 차례가 있는 한 벌이다. 컬렉션이 뒤섞여 들어와도 읽는 순서는 넣은 순서여야 한다.
     * 일부러 거꾸로 넣는다 — 정렬을 지우면 이 검사가 깨진다.
     */
    @Test
    @DisplayName("갤러리는 넣은 차례대로 나온다 — 카드뉴스의 읽는 순서")
    void keepsInsertionOrderById() {
        PopupStore popup =
                popupWith(
                        image(30L, "/c.webp", PopupImage.ORIGIN_USER, "N"),
                        image(10L, "/a.webp", PopupImage.ORIGIN_USER, "N"),
                        image(20L, "/b.webp", PopupImage.ORIGIN_USER, "N"));

        assertThat(PopupGalleryImageDto.galleryOf(popup))
                .extracting(PopupGalleryImageDto::getImageUrl)
                .containsExactly("/a.webp", "/b.webp", "/c.webp");
    }

    @Test
    @DisplayName("대표 이미지는 갤러리에서 빠진다 — 히어로가 이미 그린다")
    void excludesMainImage() {
        PopupStore popup =
                popupWith(
                        image(1L, "/cover.webp", PopupImage.ORIGIN_USER, "Y"),
                        image(2L, "/second.webp", PopupImage.ORIGIN_USER, "N"));

        assertThat(PopupGalleryImageDto.galleryOf(popup))
                .extracting(PopupGalleryImageDto::getImageUrl)
                .containsExactly("/second.webp");
    }

    @Test
    @DisplayName("스톡·플레이스홀더는 갤러리에 못 들어간다")
    void excludesStockAndPlaceholder() {
        PopupStore popup =
                popupWith(
                        image(1L, "https://images.pexels.com/1.jpg", PopupImage.ORIGIN_PEXELS, "N"),
                        image(2L, "https://x/p.jpg", PopupImage.ORIGIN_PLACEHOLDER, "N"),
                        image(3L, "https://x/n.jpg", null, "N"));

        assertThat(PopupGalleryImageDto.galleryOf(popup)).isEmpty();
    }

    /**
     * 오늘 운영 데이터의 모양 그대로 — 대표 한 장이 스톡. 이 변경으로 <b>기존 1,405건의 화면이 한 곳도 바뀌지 않는다</b>는 증명이다. 여기가 깨지면 사이트
     * 전체에 빈 갤러리 껍데기가 생긴 것이다.
     */
    @Test
    @DisplayName("오늘 살아 있는 팝업(스톡 대표 한 장)은 갤러리가 비어 있다")
    void todaysLivePopupsGetNothing() {
        PopupStore popup =
                popupWith(
                        image(
                                1L,
                                "https://images.pexels.com/x.jpg",
                                PopupImage.ORIGIN_PEXELS,
                                "Y"));

        assertThat(PopupGalleryImageDto.galleryOf(popup)).isEmpty();
    }

    @Test
    @DisplayName("주소가 비었으면 그리지 않는다 — 깨진 이미지 칸을 만들지 않는다")
    void excludesBlankUrl() {
        PopupStore popup =
                popupWith(
                        image(1L, "   ", PopupImage.ORIGIN_USER, "N"),
                        image(2L, null, PopupImage.ORIGIN_USER, "N"));

        assertThat(PopupGalleryImageDto.galleryOf(popup)).isEmpty();
    }

    @Test
    @DisplayName("이미지가 없거나 목록 자체가 없어도 터지지 않는다")
    void survivesMissingImages() {
        assertThat(PopupGalleryImageDto.galleryOf(new PopupStore())).isEmpty();

        PopupStore nullImages = new PopupStore();
        nullImages.setImages(null);
        assertThat(PopupGalleryImageDto.galleryOf(nullImages)).isEmpty();

        assertThat(PopupGalleryImageDto.galleryOf(null)).isEmpty();
    }

    @Test
    @DisplayName("출처 표시에 필요한 값이 함께 실려 나간다 — 저작권법 §37")
    void carriesCreditFields() {
        PopupImage img = image(1L, "/partner/a.webp", PopupImage.ORIGIN_USER, "N");
        img.setPhotoCreditName("제주창조경제혁신센터");
        img.setPhotoCreditUrl("https://jccei.kr");
        img.setPhotoSourceUrl("https://jccei.kr/notice/1");

        PopupGalleryImageDto dto = PopupGalleryImageDto.galleryOf(popupWith(img)).get(0);

        assertThat(dto.getPhotoCreditName()).isEqualTo("제주창조경제혁신센터");
        assertThat(dto.getPhotoCreditUrl()).isEqualTo("https://jccei.kr");
        assertThat(dto.getPhotoSourceUrl()).isEqualTo("https://jccei.kr/notice/1");
        assertThat(dto.getPhotoOrigin()).isEqualTo(PopupImage.ORIGIN_USER);
    }

    @Test
    @DisplayName("공개 상세 응답이 갤러리를 함께 보낸다")
    void detailDtoCarriesGallery() {
        PopupStore popup =
                popupWith(
                        image(1L, "https://images.pexels.com/x.jpg", PopupImage.ORIGIN_PEXELS, "Y"),
                        image(2L, "/partner/jeju-01.webp", PopupImage.ORIGIN_USER, "N"));

        PopupPublicDetailDto detail = PopupPublicDetailDto.fromEntity(popup);

        assertThat(detail.getImages())
                .extracting(PopupGalleryImageDto::getImageUrl)
                .containsExactly("/partner/jeju-01.webp");
    }
}
