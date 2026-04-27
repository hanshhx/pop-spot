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
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 결제 처리 — 위변조 방어 강화.
 *
 * 변경 사항:
 *   1) 프론트가 보낸 amount 신뢰 X. 아임포트 서버에서 실제 결제 내역 다시 조회.
 *   2) DB 의 상품 가격과 서버 측 결제 금액 비교. 불일치 시 자동 취소 + SecurityException.
 *   3) 결제 상태 paid 만 허용.
 *   4) imp_uid 중복 결제 차단.
 *   5) 인증된 본인의 userId 만 사용. dto 의 userId 는 무시.
 *   6) 테스트 모드(amount=100/0) 우회 로직 제거.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final GoodsRepository goodsRepository;
    private final IamportService iamportService;

    @Transactional
    public void processOrder(OrderController.OrderDto dto, Authentication authentication) {
        // ---- 0. 인증된 사용자만 결제 가능 ----
        if (authentication == null || authentication.getName() == null) {
            throw new SecurityException("로그인이 필요합니다.");
        }
        String authUserId = authentication.getName();

        if (dto.getImpUid() == null || dto.getImpUid().isBlank()) {
            throw new IllegalArgumentException("imp_uid 누락");
        }
        if (dto.getGoodsId() == null) {
            throw new IllegalArgumentException("상품 ID 누락");
        }

        // ---- 1. 중복 결제 차단 ----
        if (orderRepository.existsByImpUid(dto.getImpUid())) {
            throw new IllegalStateException("이미 처리된 주문입니다.");
        }

        // ---- 2. 상품 정보 조회 (서버 가격이 진실) ----
        Goods goods = goodsRepository.findById(dto.getGoodsId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 상품입니다."));

        int expectedAmount = goods.getPrice() == null ? 0 : goods.getPrice();

        // ---- 3. 아임포트 서버 실시간 검증 ----
        if (!iamportService.isConfigured()) {
            throw new IllegalStateException("결제 검증 모듈이 설정되지 않았습니다. 관리자에게 문의하세요.");
        }

        IamportService.PaymentInfo payment = iamportService.findPaymentByImpUid(dto.getImpUid());

        if (!"paid".equals(payment.status())) {
            log.warn("결제 상태 비정상 impUid={} status={}", payment.impUid(), payment.status());
            throw new IllegalStateException("결제 상태가 정상이 아닙니다: " + payment.status());
        }

        if (payment.amount() != expectedAmount) {
            log.warn("⚠️ 결제 금액 위변조 의심 impUid={} server={} expected={}",
                    payment.impUid(), payment.amount(), expectedAmount);
            iamportService.cancelPayment(payment.impUid(), "amount_mismatch", payment.amount());
            throw new SecurityException("결제 금액 위변조가 감지되어 자동 취소되었습니다.");
        }

        // ---- 4. 주문 저장 ----
        Orders order = Orders.builder()
                .userId(authUserId)
                .impUid(payment.impUid())
                .merchantUid(payment.merchantUid())
                .goodsId(dto.getGoodsId())
                .goodsName(goods.getName())
                .amount(payment.amount())
                .build();
        orderRepository.save(order);

        // ---- 5. 사용자 권한/아이템 지급 ----
        User user = userRepository.findById(authUserId)
                .orElseThrow(() -> new IllegalStateException("유저 없음"));

        String normalizeName = goods.getName() == null
                ? ""
                : goods.getName().toUpperCase().replace(" ", "").replace("-", "");

        if (normalizeName.contains("PASS") || normalizeName.contains("멤버십")) {
            user.extendPremium(30);
            if (user.getPremiumExpiryDate() == null) {
                user.setPremiumExpiryDate(LocalDateTime.now().plusDays(30));
            }
            user.setPremium(true);
            log.info("👑 PASS 지급 userId={} expiry={}", authUserId, user.getPremiumExpiryDate());
        } else if (normalizeName.contains("확성기") || normalizeName.contains("MEGAPHONE")) {
            user.addMegaphone(1);
            log.info("📢 확성기 지급 userId={} count={}", authUserId, user.getMegaphoneCount());
        }

        userRepository.saveAndFlush(user);
        log.info("✅ 주문 완료 impUid={} userId={} amount={}", payment.impUid(), authUserId, payment.amount());
    }
}
