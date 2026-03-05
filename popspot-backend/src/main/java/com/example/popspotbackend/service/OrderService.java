package com.example.popspotbackend.service;

import com.example.popspotbackend.controller.OrderController;
import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.entity.Orders;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.GoodsRepository;
import com.example.popspotbackend.repository.OrderRepository;
import com.example.popspotbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime; // 🔥 [임의 추가] 날짜 세팅을 위해 추가했습니다.

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final GoodsRepository goodsRepository;

    @Transactional
    public void processOrder(OrderController.OrderDto dto) {
        System.out.println("=========================================");
        System.out.println("🔥 [주문 요청 도착]");
        System.out.println("👤 유저 ID: " + dto.getUserId());
        System.out.println("📦 상품명: " + dto.getGoodsName());

        // 1. 상품 정보 조회
        Goods goods = goodsRepository.findById(dto.getGoodsId())
                .orElseThrow(() -> new RuntimeException("존재하지 않는 상품입니다."));

        // (가격 검증 로직 생략 - 기존 유지)
        if (!goods.getPrice().equals(dto.getAmount())) {
            if (dto.getAmount() == 100 || dto.getAmount() == 0) {
                System.out.println("⚠️ [TEST_MODE] 테스트 결제 승인");
            } else {
                throw new RuntimeException("결제 금액 불일치");
            }
        }

        // 2. 주문 내역 저장
        Orders order = Orders.builder()
                .userId(dto.getUserId())
                .impUid(dto.getImpUid())
                .merchantUid(dto.getMerchantUid())
                .goodsId(dto.getGoodsId())
                .goodsName(dto.getGoodsName())
                .amount(dto.getAmount())
                .build();
        orderRepository.save(order);

        // 3. 유저 아이템 지급
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new RuntimeException("유저 없음"));

        String rawName = dto.getGoodsName();
        String normalizeName = rawName.toUpperCase().replace(" ", "").replace("-", "");

        if (normalizeName.contains("PASS") || normalizeName.contains("멤버십")) {
            System.out.println("🎫 [POP-PASS] 멤버십 구매 감지.");
            System.out.println("   - 기존 만료일: " + user.getPremiumExpiryDate());

            // 30일 연장 메서드 호출 (기존 로직 유지)
            user.extendPremium(30);

            // 🔥 [임의 수정 및 추가] user.extendPremium(30)이 DB에 제대로 반영되지 않거나 null 예외를 내는 것을 방지하기 위해,
            // 서비스 단에서 직접 isPremium 값을 true로 확실히 세팅하고, 만료일이 null인 경우 현재 시간 + 30일로 명시적 덮어쓰기를 수행합니다.
            user.setPremium(true);
            if (user.getPremiumExpiryDate() == null) {
                user.setPremiumExpiryDate(LocalDateTime.now().plusDays(30));
            }

            System.out.println("   - 갱신된(강제 덮어쓰기) 만료일: " + user.getPremiumExpiryDate());
            System.out.println("👑 프리미엄 적용 완료!");
        }
        else if (normalizeName.contains("확성기") || normalizeName.contains("MEGAPHONE")) {
            user.addMegaphone(1);
            System.out.println("📢 확성기 지급 완료! (현재 보유량: " + user.getMegaphoneCount() + ")");
        }

        // 🔥 [핵심 수정] save() -> saveAndFlush()로 변경하여 트랜잭션 내에서 강제로 DB 반영을 유도합니다.
        userRepository.saveAndFlush(user);

        System.out.println("💾 DB 강제 저장(Flush) 완료");
        System.out.println("=========================================");
    }
}