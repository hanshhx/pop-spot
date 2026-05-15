package com.example.popspotbackend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 팝업스토어에 묶인 굿즈(상품) 아이템. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "GOODS")
public class Goods {

    @Id
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
