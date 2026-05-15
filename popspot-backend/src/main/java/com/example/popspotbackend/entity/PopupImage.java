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

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "IMAGE_URL")
    private String imageUrl;

    @Column(name = "MAIN_YN")
    private String mainYn;
}
