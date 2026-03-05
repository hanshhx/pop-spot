package com.example.popspotbackend.entity;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "WISHLIST", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "popup_store_id"}) // 중복 방지
})
public class Wishlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // 🔥 [수정됨] 프로젝트에 있는 'PopupStore' 클래스 사용
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "popup_store_id", nullable = false)
    private PopupStore popupStore;
}