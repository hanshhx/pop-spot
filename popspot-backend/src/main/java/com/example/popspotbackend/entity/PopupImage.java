package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 팝업스토어 이미지 갤러리의 개별 사진.
 *
 * <p>{@code mainYn} = "Y" 인 row 가 대표 이미지로 노출. 한 팝업당 정확히 하나만 Y 이도록 서비스 레이어에서 보장한다.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "POPUP_IMAGE")
public class PopupImage {

    /** 검색 결과 원문에서 가져온 실제 팝업 사진. */
    public static final String ORIGIN_CRAWLED = "CRAWLED";

    /** Pexels 스톡 자동 배정 — 실제 팝업과 무관한 대체 이미지. */
    public static final String ORIGIN_PEXELS = "PEXELS";

    /** 관리자·사용자가 직접 올린 사진. */
    public static final String ORIGIN_USER = "USER";

    /** 이미지 자체가 없어 상수 폴백을 쓰는 상태(엔티티 저장 안 됨, 표현용). */
    public static final String ORIGIN_PLACEHOLDER = "PLACEHOLDER";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "IMAGE_URL")
    private String imageUrl;

    @Column(name = "MAIN_YN")
    private String mainYn;

    /**
     * 사진 출처. 실사진(CRAWLED·USER)과 스톡(PEXELS)을 구분해, 랜딩·상세가 스톡·플레이스홀더를 실제 사진처럼 보여주지 않게 한다.
     *
     * <p>지금까지 이미지 저장 경로는 Pexels 백필 하나뿐이라 기존 행은 전부 PEXELS 로 백필된다(V20).
     */
    @Column(name = "PHOTO_ORIGIN", length = 20)
    private String photoOrigin;

    /** Pexels 고유 사진 ID. DB 고유 인덱스로 한 사진이 둘 이상의 팝업에 배정되는 것을 막는다. */
    @Column(name = "PEXELS_PHOTO_ID")
    private Long pexelsPhotoId;

    /** 해당 사진의 Pexels 상세 페이지. */
    @Column(name = "PHOTO_SOURCE_URL", columnDefinition = "TEXT")
    private String photoSourceUrl;

    @Column(name = "PHOTO_CREDIT_NAME", length = 200)
    private String photoCreditName;

    @Column(name = "PHOTO_CREDIT_URL", columnDefinition = "TEXT")
    private String photoCreditUrl;
}
