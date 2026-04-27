package com.example.popspotbackend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "GOODS")
public class Goods {

    @Id
    // 🔥 [수정] Oracle Sequence 제거 -> MySQL Identity 사용
    // @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GOODS_SEQ_GEN")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "GOODS_ID")
    private Long id;

    private String name;
    private Integer price;

    @Column(length = 1000)
    private String imageUrl;

    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "POPUP_ID")
    @JsonIgnore
    private PopupStore popupStore;
}