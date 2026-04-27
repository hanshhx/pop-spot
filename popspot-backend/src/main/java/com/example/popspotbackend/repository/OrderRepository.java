package com.example.popspotbackend.repository;
import com.example.popspotbackend.entity.Orders;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderRepository extends JpaRepository<Orders, Long> {
    List<Orders> findByUserId(String userId);

    /** 동일 imp_uid 로 이미 처리된 주문 차단 (중복 결제 방어) */
    boolean existsByImpUid(String impUid);
}