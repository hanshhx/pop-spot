package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.controller.OrderController;
import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.entity.Orders;
import com.example.popspotbackend.repository.GoodsRepository;
import com.example.popspotbackend.repository.OrderRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private GoodsRepository goodsRepository;
    @Mock private IamportService iamportService;
    @Mock private Authentication authentication;

    private OrderService service;

    @BeforeEach
    void setUp() {
        service =
                new OrderService(orderRepository, userRepository, goodsRepository, iamportService);
    }

    @Test
    void 결제완료는_서버가_준비한_사용자와_merchantUid에_묶인다() {
        OrderController.OrderDto dto = new OrderController.OrderDto();
        dto.setImpUid("imp-1");
        dto.setMerchantUid("merchant-safe");
        dto.setGoodsId(1L);

        Orders prepared =
                Orders.builder()
                        .userId("user-1")
                        .merchantUid("merchant-safe")
                        .goodsId(1L)
                        .amount(1000)
                        .status("PREPARED")
                        .build();
        Goods goods = new Goods();
        goods.setId(1L);
        goods.setName("확성기");
        goods.setPrice(1000);

        when(authentication.getName()).thenReturn("user-1");
        when(orderRepository.findPreparedForUpdate("merchant-safe", "user-1"))
                .thenReturn(Optional.of(prepared));
        when(orderRepository.findByImpUid("imp-1")).thenReturn(Optional.empty());
        when(goodsRepository.findById(1L)).thenReturn(Optional.of(goods));
        when(iamportService.isConfigured()).thenReturn(true);
        when(iamportService.findPaymentByImpUid("imp-1"))
                .thenReturn(
                        new IamportService.PaymentInfo(
                                "imp-1", "merchant-attacker", "paid", 1000, null, 0L));

        assertThatThrownBy(() -> service.processOrder(dto, authentication))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("주문번호");
        verify(orderRepository, never()).saveAndFlush(prepared);
        verify(userRepository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
    }
}
