package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.OrderService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 주문 처리 엔드포인트.
 *
 * <p>스푸핑 방지를 위해 {@code userId} / 결제 금액 / 상품명은 클라이언트가 보낸 값이 아니라 인증 컨텍스트와 아임포트 서버 / DB 의 권위 있는 값으로 다시
 * 계산한다. {@link OrderDto} 에 남아있는 필드는 하위 호환을 위해 두지만 서버에서 무시된다.
 */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrderController {

    private final OrderService orderService;

    /** 결제창을 열기 전에 서버가 사용자·상품·금액에 묶인 merchantUid를 발급한다. */
    @PostMapping("/prepare")
    public ResponseEntity<OrderService.PreparedOrder> prepareOrder(
            @RequestBody PrepareOrderDto dto, Authentication authentication) {
        return ResponseEntity.ok(orderService.prepareOrder(dto.getGoodsId(), authentication));
    }

    @PostMapping("/complete")
    public ResponseEntity<String> completeOrder(
            @RequestBody OrderDto dto, Authentication authentication) {
        orderService.processOrder(dto, authentication);
        return ResponseEntity.ok("주문 처리 완료");
    }

    @Data
    public static class OrderDto {
        /** 무시 — 서버는 인증 컨텍스트로 사용자 식별. */
        private String userId;

        private String impUid;

        /** 검증 후 서버 값 사용. */
        private String merchantUid;

        private Long goodsId;

        /** 무시 — 서버는 DB 의 상품명 사용. */
        private String goodsName;

        /** 무시 — 서버는 아임포트 조회 금액 사용. */
        private Integer amount;
    }

    @Data
    public static class PrepareOrderDto {
        private Long goodsId;
    }
}
