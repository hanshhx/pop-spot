package com.example.popspotbackend.service.sla;

import com.example.popspotbackend.repository.FeedbackRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.EmailService;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * v2.17 — SLA 24시간 미처리 알림.
 *
 * <p>두 가지 약속을 추적:
 *
 * <ul>
 *   <li>이용약관 §11 — Takedown 신고 24시간 안에 admin 결정 (영구 삭제 / 수정 후 복구 / 부적절 신고 거부) 의무
 *   <li>v2.11 운영 약속 — Feedback 24시간 안에 답변 (또는 상태 변경)
 * </ul>
 *
 * <p>매시간 cron 으로 두 카운트를 조회해 0 이 아니면 운영자 메일 전송. 알림 수신처 ({@code popspot.sla.notify-email}) 가 비어 있으면
 * 비활성.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SlaNotificationScheduler {

    private static final int SLA_HOURS = 24;
    private static final String FEEDBACK_PENDING = "PENDING";

    private final FeedbackRepository feedbackRepository;
    private final PopupStoreRepository popupStoreRepository;
    private final EmailService emailService;

    @Value("${popspot.sla.notify-email:}")
    private String notifyEmail;

    @Scheduled(cron = "${popspot.sla.cron:0 0 * * * *}", zone = "Asia/Seoul")
    public void scheduledCheck() {
        if (notifyEmail == null || notifyEmail.isBlank()) {
            log.debug("[SLA] 알림 수신처 미설정 → 스킵");
            return;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusHours(SLA_HOURS);

        long overdueFeedback = feedbackRepository.countOlderThan(FEEDBACK_PENDING, cutoff);
        long overdueTakedown = popupStoreRepository.countTakedownOlderThan(cutoff);

        if (overdueFeedback == 0 && overdueTakedown == 0) {
            log.debug("[SLA] 미처리 0 — 알림 스킵");
            return;
        }

        String subject =
                "[POP-SPOT SLA] 24시간 미처리 항목 — Feedback "
                        + overdueFeedback
                        + " / Takedown "
                        + overdueTakedown;
        String body =
                "POP-SPOT 24시간 SLA 알림\n\n"
                        + "기준 시각: "
                        + cutoff
                        + "\n"
                        + "---------------------------------\n"
                        + "Feedback (PENDING 24h 초과): "
                        + overdueFeedback
                        + " 건\n"
                        + "Takedown (24h 초과): "
                        + overdueTakedown
                        + " 건\n"
                        + "---------------------------------\n\n"
                        + "어드민 콘솔에서 즉시 처리해 주세요.\n"
                        + "- /admin → 의견 보내기 탭 (PENDING 필터)\n"
                        + "- /admin → 팝업스토어 제어 (reviewStatus=TAKEDOWN 필터)\n";

        boolean sent = emailService.sendNotification(notifyEmail, subject, body);
        if (sent) {
            log.info("[SLA] 알림 발송 완료 — Feedback={}, Takedown={}", overdueFeedback, overdueTakedown);
        }
    }
}
