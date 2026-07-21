package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.PopupImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface PopupImageRepository extends JpaRepository<PopupImage, Long> {

    /**
     * 대표 이미지 1건 직접 삽입.
     *
     * <p>{@code PopupStore.images} 는 {@code @OneToMany @JoinColumn(popup_id)} 이고 cascade 가 없어, 엔티티
     * 그래프로 저장하려면 부모 재저장 + 추가 UPDATE 가 필요하다. 커버 백필은 팝업당 최초 1장만 붙이면 되므로 FK 를 직접 지정하는 네이티브 INSERT 로
     * 단순·명확하게 처리한다. id 는 IDENTITY 로 DB 가 채운다.
     */
    @Modifying
    @Transactional
    @Query(
            value =
                    "INSERT INTO popup_image (image_url, main_yn, popup_id, photo_origin) VALUES"
                            + " (:url, 'Y', :popupId, :origin)",
            nativeQuery = true)
    void insertMainImage(
            @Param("popupId") Long popupId,
            @Param("url") String url,
            @Param("origin") String origin);
}
