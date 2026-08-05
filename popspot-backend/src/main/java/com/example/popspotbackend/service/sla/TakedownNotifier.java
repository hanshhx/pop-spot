package com.example.popspotbackend.service.sla;

import static com.example.popspotbackend.service.sla.SlaNotificationScheduler.SLA_HOURS;

import com.example.popspotbackend.config.LogSafe;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.EmailService;
import java.time.LocalDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * v2.54 — Takedown <b>접수 즉시</b> 운영자에게 알린다.
 *
 * <p><b>왜 필요했나.</b> 알림이 {@link SlaNotificationScheduler} 하나뿐이었는데, 그것은 {@code now - 24h} 보다 오래된 건을
 * 세는 <b>사후 감사</b>다. 즉 운영자는 24시간이 <b>지난 뒤에야</b> 신고가 있었다는 사실을 알았다. 그런데 접수 응답은 "권리 관계 확인 후 24시간 내
 * 조치합니다" 라고 약속하고, 이용약관 §11 도 같은 의무를 진다 — 구조적으로 지킬 수 없는 약속이었다.
 *
 * <p>둘은 역할이 다르므로 둘 다 남긴다. 이 클래스는 <b>작업 지시</b>(지금 하나 들어왔다), 스케줄러는 <b>미이행 감사</b>(24시간을 넘긴 것이 아직 남아
 * 있다). 하나로 합치면 항상 늦거나 항상 시끄럽다.
 *
 * <p><b>수신처는 {@code popspot.sla.notify-email} 하나로 통일한다.</b> 예전엔 {@code
 * popspot.crawler.takedown-notify-email} 이 설정 파일에 따로 있었는데 <b>읽는 코드가 하나도 없었다.</b> 값을 채워 넣고 "알림이
 * 오겠거니" 오해하기 딱 좋은 상태여서 그 키는 지웠다. 수신처가 둘이면 설정을 빠뜨릴 자리도 둘이 된다.
 *
 * <p><b>전용 스레드로 보내는 이유.</b> 이 알림은 공개 엔드포인트의 요청 경로에서 호출된다. SMTP 타임아웃이 connect/read/write 각 5초라 최악
 * 15초가 응답에 얹힌다. 신고자를 15초 기다리게 할 이유가 없고, 메일 발송 성공 여부가 접수 성공 여부를 바꾸지도 않는다({@link
 * EmailService#sendNotification} 은 예외를 밖으로 던지지 않고 false 만 돌려준다). 데몬 단일 스레드라 밀려도 스레드가 쌓이지 않는다.
 */
@Slf4j
@Component
public class TakedownNotifier {

    private final EmailService emailService;
    private final String notifyEmail;
    private final ExecutorService sender;

    /**
     * <b>{@code @Autowired} 를 지우지 마라.</b> 이 클래스에는 생성자가 둘이다(운영용·테스트용). Spring 은 생성자가 여럿인데 어느 것도 표시돼
     * 있지 않으면 <b>기본 생성자를 찾고</b>, 그것이 없으므로 {@code NoSuchMethodException: <init>()} 로 기동 자체가 실패한다.
     *
     * <p>2026-08-05 에 실제로 이걸로 서비스가 죽었다. 단위 테스트는 생성자를 직접 부르기 때문에 전부 통과했고 — 컨텍스트를 띄우지 않으면 잡히지 않는 종류의
     * 실패다.
     */
    @Autowired
    public TakedownNotifier(
            EmailService emailService, @Value("${popspot.sla.notify-email:}") String notifyEmail) {
        this(emailService, notifyEmail, defaultExecutor());
    }

    /** 테스트에서 동기 실행기를 넣어 발송을 검증하기 위한 생성자. */
    TakedownNotifier(EmailService emailService, String notifyEmail, ExecutorService sender) {
        this.emailService = emailService;
        this.notifyEmail = notifyEmail;
        this.sender = sender;
    }

    private static ExecutorService defaultExecutor() {
        return Executors.newSingleThreadExecutor(
                r -> {
                    Thread t = new Thread(r, "takedown-notify");
                    // 데몬으로 두어 종료 시 이 스레드가 셧다운을 붙잡지 않게 한다.
                    t.setDaemon(true);
                    return t;
                });
    }

    /**
     * 새로 접수된 신고 하나를 알린다. <b>재신고에는 호출하지 않는다</b> — 최초 기록만 보존하는 {@code applyTakedown} 의 정책과 같은 이유로,
     * 재신고마다 메일이 오면 알림이 소음이 된다.
     *
     * @param popup 신고 대상. 이미 {@code takedownRequestedAt} 이 채워진 상태여야 한다.
     */
    public void notifyFiled(PopupStore popup) {
        if (notifyEmail == null || notifyEmail.isBlank()) {
            log.warn(
                    "[Takedown] 알림 수신처(popspot.sla.notify-email) 미설정 → 접수 알림을 보내지 못했다."
                            + " 약관 §11 의 24시간 조치 약속을 지키려면 이 값이 필요하다. popupId={}",
                    popup.getId());
            return;
        }
        String subject = "[POP-SPOT] Takedown 신고 접수 — " + popup.getName();
        String body = buildBody(popup);
        sender.execute(
                () -> {
                    boolean sent = emailService.sendNotification(notifyEmail, subject, body);
                    if (sent) {
                        log.info("[Takedown] 접수 알림 발송 완료 popupId={}", popup.getId());
                    }
                    // 실패 로그는 EmailService 가 이미 남긴다. 여기서 또 남기면 같은 사건이 두 줄이 된다.
                });
    }

    /**
     * 신고자 이메일은 <b>마스킹한다.</b> 운영자는 어드민에서 원본을 볼 수 있으므로, 메일함에까지 평문으로 복제해 보관 지점을 늘릴 이유가 없다. 사유는 넣는다 —
     * 무엇을 검토해야 하는지 판단하려면 그것이 있어야 하고, 없으면 결국 어드민을 열어야 해서 알림의 의미가 없어진다.
     */
    private String buildBody(PopupStore popup) {
        LocalDateTime at = popup.getTakedownRequestedAt();
        LocalDateTime due = at != null ? at.plusHours(SLA_HOURS) : null;
        return "POP-SPOT Takedown 신고가 접수됐습니다.\n\n"
                + "---------------------------------\n"
                + "팝업 ID   : "
                + popup.getId()
                + "\n"
                + "이름      : "
                + popup.getName()
                + "\n"
                + "접수 시각 : "
                + at
                + "\n"
                + "조치 기한 : "
                + due
                + "  (약관 §11, 24시간)\n"
                + "신고자    : "
                + LogSafe.email(popup.getTakedownRequester())
                + "  (원본은 어드민에서 확인)\n"
                + "---------------------------------\n"
                + "사유:\n"
                + (popup.getTakedownReason() == null ? "(없음)" : popup.getTakedownReason())
                + "\n---------------------------------\n\n"
                + "어드민 콘솔에서 처리해 주세요.\n"
                + "- /admin → 팝업스토어 제어 (reviewStatus=TAKEDOWN 필터)\n";
    }
}
