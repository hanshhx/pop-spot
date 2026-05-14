package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 팝업 방문 스탬프.
 *
 * <p>{@code USER_ID + POPUP_ID} 에 unique 제약을 걸어 동시성 race condition 으로 인한 중복 적립을 DB 차원에서 차단한다. 하루 1회
 * 제한은 서비스 레이어에서 별도 검사하며 이 제약은 평생 중복만 막는다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "STAMP",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "uk_stamp_user_popup",
                    columnNames = {"USER_ID", "POPUP_ID"})
        })
public class Stamp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "STAMP_ID")
    private Long id;

    @Column(name = "USER_ID", nullable = false)
    private String userId;

    /** N+1 회피를 위해 LAZY 로딩. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "POPUP_ID", nullable = false)
    private PopupStore popupStore;

    @Column(name = "STAMP_DATE")
    private LocalDateTime stampDate;

    @PrePersist
    public void prePersist() {
        this.stampDate = LocalDateTime.now();
    }
}
