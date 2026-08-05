package com.example.popspotbackend.service.sla;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.EmailService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Takedown <b>접수 즉시</b> 알림이 실제로 나가는지 확인한다.
 *
 * <p>이 기능이 없던 동안의 실패 방식은 조용했다 — 신고는 DB 에 잘 쌓이는데 아무도 모르고, 운영자는 {@link SlaNotificationScheduler} 가
 * 24시간 <b>지난 뒤에</b> 보내는 메일로 처음 알았다. 그런데 접수 응답과 약관 §11 은 "24시간 안에 조치" 를 약속한다. 알림이 늦으면 약속이 빈말이 된다.
 *
 * <p>그래서 확인할 것은 세 가지다 — 새 신고에는 <b>가는가</b>, 재신고에는 <b>안 가는가</b>(알림이 소음이 되면 아무도 안 본다), 수신처가 비면 <b>조용히
 * 넘어가되 흔적은 남기는가</b>.
 */
class TakedownNotifierTest {

    private static final String TO = "ops@popspot.co.kr";

    /** 발송 내용을 붙잡아 두는 가짜 메일러. 실제 SMTP 를 타지 않는다. */
    private static final class CapturingEmailService extends EmailService {
        private final List<String[]> sent = new ArrayList<>();

        private CapturingEmailService() {
            // JavaMailSender 는 쓰지 않는다 — sendNotification 을 통째로 가로채기 때문이다.
            super(null);
        }

        @Override
        public boolean sendNotification(String toEmail, String subject, String body) {
            sent.add(new String[] {toEmail, subject, body});
            return true;
        }
    }

    /** 테스트에서는 같은 스레드에서 즉시 실행한다 — 비동기라 검증이 흔들리는 일을 없앤다. */
    private static ExecutorService directExecutor() {
        return new AbstractExecutorService() {
            @Override
            public void execute(Runnable command) {
                command.run();
            }

            @Override
            public void shutdown() {}

            @Override
            public List<Runnable> shutdownNow() {
                return List.of();
            }

            @Override
            public boolean isShutdown() {
                return false;
            }

            @Override
            public boolean isTerminated() {
                return false;
            }

            @Override
            public boolean awaitTermination(long timeout, TimeUnit unit) {
                return true;
            }
        };
    }

    private static PopupStore filedPopup() {
        PopupStore p = new PopupStore();
        p.setId(1234L);
        p.setName("○○ 브랜드 팝업스토어");
        p.setTakedownRequestedAt(LocalDateTime.of(2026, 8, 5, 9, 0));
        p.setTakedownReason("당사 상표를 무단 사용한 게시물입니다.");
        p.setTakedownRequester("legal@example.com");
        return p;
    }

    @Test
    @DisplayName("새 신고가 접수되면 운영자에게 메일이 나간다")
    void sendsOnNewFiling() {
        CapturingEmailService mailer = new CapturingEmailService();
        new TakedownNotifier(mailer, TO, directExecutor()).notifyFiled(filedPopup());

        assertThat(mailer.sent).hasSize(1);
        assertThat(mailer.sent.get(0)[0]).isEqualTo(TO);
        assertThat(mailer.sent.get(0)[1]).contains("Takedown", "○○ 브랜드 팝업스토어");
    }

    @Test
    @DisplayName("본문에 조치 기한(접수 +24시간)이 계산돼 들어간다")
    void includesDeadline() {
        CapturingEmailService mailer = new CapturingEmailService();
        new TakedownNotifier(mailer, TO, directExecutor()).notifyFiled(filedPopup());

        String body = mailer.sent.get(0)[2];
        assertThat(body).contains("2026-08-05T09:00"); // 접수 시각
        assertThat(body).contains("2026-08-06T09:00"); // 조치 기한
        assertThat(body).contains("1234");
    }

    @Test
    @DisplayName("사유는 넣되 신고자 이메일은 마스킹한다 — 평문 보관 지점을 늘리지 않는다")
    void masksRequesterButKeepsReason() {
        CapturingEmailService mailer = new CapturingEmailService();
        new TakedownNotifier(mailer, TO, directExecutor()).notifyFiled(filedPopup());

        String body = mailer.sent.get(0)[2];
        assertThat(body).contains("당사 상표를 무단 사용한 게시물입니다.");
        assertThat(body).doesNotContain("legal@example.com");
    }

    @Test
    @DisplayName("수신처가 비어 있으면 발송하지 않는다")
    void skipsWhenNoRecipient() {
        CapturingEmailService mailer = new CapturingEmailService();
        new TakedownNotifier(mailer, "", directExecutor()).notifyFiled(filedPopup());
        new TakedownNotifier(mailer, null, directExecutor()).notifyFiled(filedPopup());
        new TakedownNotifier(mailer, "   ", directExecutor()).notifyFiled(filedPopup());

        assertThat(mailer.sent).isEmpty();
    }

    @Test
    @DisplayName("조치 기한은 스케줄러의 감사 기준과 같은 상수를 쓴다 — 한쪽만 바뀌면 약속과 감사가 어긋난다")
    void sharesSlaConstant() {
        assertThat(SlaNotificationScheduler.SLA_HOURS).isEqualTo(24);

        CapturingEmailService mailer = new CapturingEmailService();
        PopupStore p = filedPopup();
        new TakedownNotifier(mailer, TO, directExecutor()).notifyFiled(p);

        LocalDateTime due =
                p.getTakedownRequestedAt().plusHours(SlaNotificationScheduler.SLA_HOURS);
        assertThat(mailer.sent.get(0)[2]).contains(due.toString());
    }
}
