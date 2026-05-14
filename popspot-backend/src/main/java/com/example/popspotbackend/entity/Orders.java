package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 주문 영수증. {@code impUid} 가 unique 제약으로 중복 결제를 차단한다 (재시도 idempotency).
 *
 * <p>PostgreSQL 환경이므로 IDENTITY 대신 SEQUENCE 를 사용한다. 기존 테이블을 유지하면서 안전하게 PK 를 생성할 수 있다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "ORDERS")
public class Orders {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "orders_seq_gen")
    @SequenceGenerator(name = "orders_seq_gen", sequenceName = "orders_seq", allocationSize = 1)
    @Column(name = "ORDER_ID")
    private Long id;

    @Column(name = "USER_ID")
    private String userId;

    @Column(name = "IMP_UID")
    private String impUid;

    @Column(name = "MERCHANT_UID")
    private String merchantUid;

    @Column(name = "GOODS_ID")
    private Long goodsId;

    @Column(name = "GOODS_NAME")
    private String goodsName;

    @Column(name = "AMOUNT")
    private Integer amount;

    @Column(name = "ORDER_DATE")
    private LocalDateTime orderDate;

    @PrePersist
    public void prePersist() {
        this.orderDate = LocalDateTime.now();
    }
}
