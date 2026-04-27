package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "ORDERS")
public class Orders {

    @Id
    // 🚨 [에러 해결 포인트] 동현님의 DB는 PostgreSQL입니다!
    // IDENTITY 방식은 컬럼이 SERIAL 타입일 때만 작동하므로,
    // 기존 테이블을 유지하면서 가장 안전하게 번호를 생성하는 SEQUENCE 방식으로 수정했습니다.
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "orders_seq_gen")
    @SequenceGenerator(name = "orders_seq_gen", sequenceName = "orders_seq", allocationSize = 1)
    @Column(name = "ORDER_ID") // DB 컬럼명과 일치시킴
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