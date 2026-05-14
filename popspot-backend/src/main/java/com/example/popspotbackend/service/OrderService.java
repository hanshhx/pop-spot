package com.example.popspotbackend.service;

import com.example.popspotbackend.controller.OrderController;
import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.entity.Orders;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.GoodsRepository;
import com.example.popspotbackend.repository.OrderRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 결제 처리 + 위변조 방어.
 *
 * <p>핵심 원칙: 클라이언트가 보낸 금액/유저ID/상품명은 신뢰하지 않는다.
 *
 * <ul>
 *   <li>금액 — 아임포트 서버에서 실시간 재조회 후 DB 가격과 대조, 불일치 시 자동 환불 + SecurityException
 *   <li>유저 — 인증 컨텍스트의 principal 사용
 *   <li>상품 — DB 의 Goods row 기반
 *   <li>중복 — {@code imp_uid} 유니크 체크로 재처리 차단
 *   <li>상태 — {@code paid} 만 허용
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final String PAYMENT_STATUS_PAID = "paid";
    private static final String CANCEL_REASON_AMOUNT_MISMATCH = "amount_mismatch";

    private static final int POPPASS_GRANT_DAYS = 30;

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final GoodsRepository goodsRepository;
    private final IamportService iamportService;

    @Transactional
    public void processOrder(OrderController.OrderDto dto, Authentication authentication) {
        String authUserId = requireAuthenticatedUser(authentication);
        validatePaymentDtoOrThrow(dto);
        rejectDuplicatePayment(dto.getImpUid());

        Goods goods = findGoodsOrThrow(dto.getGoodsId());
        IamportService.PaymentInfo payment = verifyPaymentOrThrow(dto.getImpUid(), goods);

        orderRepository.save(buildOrderRecord(authUserId, payment, goods));
        grantPurchaseEntitlements(authUserId, goods);
        log.info(
                "주문 완료 impUid={} userId={} amount={}",
                payment.impUid(),
                authUserId,
                payment.amount());
    }

    /* ============================== 검증 단계 ============================== */

    private String requireAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new SecurityException("로그인이 필요합니다.");
        }
        return authentication.getName();
    }

    private void validatePaymentDtoOrThrow(OrderController.OrderDto dto) {
        if (dto.getImpUid() == null || dto.getImpUid().isBlank()) {
            throw new IllegalArgumentException("imp_uid 누락");
        }
        if (dto.getGoodsId() == null) {
            throw new IllegalArgumentException("상품 ID 누락");
        }
    }

    private void rejectDuplicatePayment(String impUid) {
        if (orderRepository.existsByImpUid(impUid)) {
            throw new IllegalStateException("이미 처리된 주문입니다.");
        }
    }

    private Goods findGoodsOrThrow(Long goodsId) {
        return goodsRepository
                .findById(goodsId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 상품입니다."));
    }

    private IamportService.PaymentInfo verifyPaymentOrThrow(String impUid, Goods goods) {
        if (!iamportService.isConfigured()) {
            throw new IllegalStateException("결제 검증 모듈이 설정되지 않았습니다. 관리자에게 문의하세요.");
        }
        IamportService.PaymentInfo payment = iamportService.findPaymentByImpUid(impUid);

        if (!PAYMENT_STATUS_PAID.equals(payment.status())) {
            log.warn("결제 상태 비정상 impUid={} status={}", payment.impUid(), payment.status());
            throw new IllegalStateException("결제 상태가 정상이 아닙니다: " + payment.status());
        }

        int expectedAmount = goods.getPrice() == null ? 0 : goods.getPrice();
        if (payment.amount() != expectedAmount) {
            log.warn(
                    "결제 금액 위변조 의심 impUid={} server={} expected={}",
                    payment.impUid(),
                    payment.amount(),
                    expectedAmount);
            iamportService.cancelPayment(
                    payment.impUid(), CANCEL_REASON_AMOUNT_MISMATCH, payment.amount());
            throw new SecurityException("결제 금액 위변조가 감지되어 자동 취소되었습니다.");
        }
        return payment;
    }

    /* ============================== 저장 / 지급 ============================== */

    private Orders buildOrderRecord(
            String userId, IamportService.PaymentInfo payment, Goods goods) {
        return Orders.builder()
                .userId(userId)
                .impUid(payment.impUid())
                .merchantUid(payment.merchantUid())
                .goodsId(goods.getId())
                .goodsName(goods.getName())
                .amount(payment.amount())
                .build();
    }

    private void grantPurchaseEntitlements(String userId, Goods goods) {
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> new IllegalStateException("유저 없음"));

        String normalized = normalizeGoodsName(goods.getName());
        if (normalized.contains("PASS") || normalized.contains("멤버십")) {
            grantPopPass(user, userId);
        } else if (normalized.contains("확성기") || normalized.contains("MEGAPHONE")) {
            user.addMegaphone(1);
            log.info("확성기 지급 userId={} count={}", userId, user.getMegaphoneCount());
        }
        userRepository.saveAndFlush(user);
    }

    private void grantPopPass(User user, String userId) {
        user.extendPremium(POPPASS_GRANT_DAYS);
        if (user.getPremiumExpiryDate() == null) {
            user.setPremiumExpiryDate(LocalDateTime.now().plusDays(POPPASS_GRANT_DAYS));
        }
        user.setPremium(true);
        log.info("POP-PASS 지급 userId={} expiry={}", userId, user.getPremiumExpiryDate());
    }

    private String normalizeGoodsName(String name) {
        if (name == null) return "";
        return name.toUpperCase().replace(" ", "").replace("-", "");
    }
}
