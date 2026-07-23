package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.Orders;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface OrderRepository extends JpaRepository<Orders, Long> {
    List<Orders> findByUserId(String userId);

    /** 동일 imp_uid 로 이미 처리된 주문 차단 (중복 결제 방어) */
    boolean existsByImpUid(String impUid);

    Optional<Orders> findByImpUid(String impUid);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Orders o WHERE o.merchantUid = :merchantUid AND o.userId = :userId")
    Optional<Orders> findPreparedForUpdate(String merchantUid, String userId);
}
