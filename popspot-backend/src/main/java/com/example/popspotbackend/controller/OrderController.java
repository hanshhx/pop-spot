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

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/complete")
    public ResponseEntity<String> completeOrder(@RequestBody OrderDto dto, Authentication authentication) {
        // userId 는 dto 가 아니라 인증 컨텍스트에서. (스푸핑 방어)
        orderService.processOrder(dto, authentication);
        return ResponseEntity.ok("주문 처리 완료");
    }

    /**
     * 클라이언트가 보내는 주문 DTO.
     *
     * userId / amount / goodsName 은 더 이상 신뢰하지 않는다.
     *  - userId   → 인증 컨텍스트에서 추출
     *  - amount   → 아임포트 서버 조회로 결정
     *  - goodsName→ DB 의 상품 정보 사용
     * 단, 하위 호환을 위해 필드는 남겨두되 서버에서 무시한다.
     */
    @Data
    public static class OrderDto {
        private String userId;       // 무시 (서버: Authentication)
        private String impUid;       // 필수
        private String merchantUid;  // 검증 후 서버 값 사용
        private Long goodsId;        // 필수
        private String goodsName;    // 무시 (서버: goods.name)
        private Integer amount;      // 무시 (서버: iamport amount)
    }
}
