package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.OrderService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/api/orders/complete")
    // 🔥 [수정 1] DTO 이름을 Service와 맞춤 (OrderRequestDto -> OrderDto)
    public ResponseEntity<String> completeOrder(@RequestBody OrderDto dto) {
        try {
            // 🔥 [수정 2] 메서드 이름 변경 (completeOrder -> processOrder)
            // 🔥 [수정 3] 파라미터 변경 (낱개 전달 -> dto 객체 통째로 전달)
            orderService.processOrder(dto);

            return ResponseEntity.ok("주문 처리 완료");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @Data
    // 🔥 [수정 4] Service에서 참조하는 클래스 이름과 일치시킴 (OrderRequestDto -> OrderDto)
    public static class OrderDto {
        private String userId;
        private String impUid;
        private String merchantUid;
        private Long goodsId;
        private String goodsName;
        private Integer amount;
    }
}