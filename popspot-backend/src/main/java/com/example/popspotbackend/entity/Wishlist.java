package com.example.popspotbackend.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 찜한 팝업 (사용자 ↔ 팝업 매핑).
 *
 * <p>{@code (user_id, popup_store_id)} 복합 유니크 제약으로 같은 팝업 중복 찜 방지.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "WISHLIST",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"user_id", "popup_store_id"})})
public class Wishlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "popup_store_id", nullable = false)
    private PopupStore popupStore;
}
