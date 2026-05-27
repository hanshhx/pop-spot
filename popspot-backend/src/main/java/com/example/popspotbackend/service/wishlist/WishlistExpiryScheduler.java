package com.example.popspotbackend.service.wishlist;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.entity.Wishlist;
import com.example.popspotbackend.repository.WishlistRepository;
import com.example.popspotbackend.service.EmailService;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * v2.18.1 — 위시 만료 D-3 알림 cron.
 *
 * <p>매일 09:00 KST 에 endDate 가 정확히 D-3 인 팝업을 찜한 사용자에게 메일 발송. 한 사용자가 여러 팝업을 찜했어도 각 팝업 한 통씩 발송 (안내
 * 단순화).
 *
 * <p>설정 키:
 *
 * <ul>
 *   <li>{@code popspot.wishlist.expiry-cron} — 기본 매일 09:00
 *   <li>{@code popspot.wishlist.expiry-days-before} — 며칠 전 알림 (기본 3)
 *   <li>{@code popspot.wishlist.enabled} — 운영 환경에서만 true (기본 false)
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WishlistExpiryScheduler {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final String EMAIL_SUBJECT_PREFIX = "[POP-SPOT] 찜한 팝업 종료 안내";

    private final WishlistRepository wishlistRepository;
    private final EmailService emailService;

    @Value("${popspot.wishlist.enabled:false}")
    private boolean enabled;

    @Value("${popspot.wishlist.expiry-days-before:3}")
    private int daysBefore;

    @Scheduled(cron = "${popspot.wishlist.expiry-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void scheduledNotify() {
        if (!enabled) {
            log.debug("[WishlistExpiry] disabled — 스킵");
            return;
        }
        String targetDate = LocalDate.now().plusDays(daysBefore).format(ISO_DATE);
        List<Wishlist> targets = wishlistRepository.findWithUserAndPopupByEndDate(targetDate);

        if (targets.isEmpty()) {
            log.debug("[WishlistExpiry] {} 종료 팝업 위시 0건 — 스킵", targetDate);
            return;
        }

        int sent = 0;
        for (Wishlist wishlist : targets) {
            if (sendNotificationFor(wishlist)) sent++;
        }
        log.info("[WishlistExpiry] D-{} 알림 발송 — 대상 {}건, 성공 {}건", daysBefore, targets.size(), sent);
    }

    private boolean sendNotificationFor(Wishlist wishlist) {
        User user = wishlist.getUser();
        PopupStore popup = wishlist.getPopupStore();
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) return false;
        if (popup == null) return false;

        String subject = EMAIL_SUBJECT_PREFIX + " — " + popup.getName();
        String body = buildBody(user, popup);
        return emailService.sendNotification(user.getEmail(), subject, body);
    }

    private String buildBody(User user, PopupStore popup) {
        return "안녕하세요, "
                + user.getNickname()
                + "님.\n\n"
                + "찜하신 팝업 \""
                + popup.getName()
                + "\" 의 종료가 "
                + daysBefore
                + "일 남았습니다.\n\n"
                + "운영 기간: "
                + (popup.getStartDate() == null ? "" : popup.getStartDate())
                + " ~ "
                + (popup.getEndDate() == null ? "" : popup.getEndDate())
                + "\n"
                + "위치: "
                + (popup.getLocation() == null ? "" : popup.getLocation())
                + "\n\n"
                + "방문 계획이 있으시다면 마감 전 다녀와 보세요.\n"
                + "POP-SPOT — https://popspot.co.kr\n";
    }
}
