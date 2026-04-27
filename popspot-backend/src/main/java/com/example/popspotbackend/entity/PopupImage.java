package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "POPUP_IMAGE") // DB 테이블 이름
public class PopupImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // 이미 IDENTITY 사용 중 -> OK
    private Long id; // 이미지 고유 ID (예: 51, 52...)

    @Column(name = "IMAGE_URL")
    private String imageUrl; // 이미지 주소

    @Column(name = "MAIN_YN") // 대표 이미지 여부 (Y/N)
    private String mainYn;

    // 만약 DB 컬럼명이 단순히 'YN' 이라면 @Column(name="YN")으로 바꾸세요.
    // 사용자님 데이터(Y)를 보니 컬럼명이 MAIN_YN 또는 IS_MAIN 일 것 같습니다.
}