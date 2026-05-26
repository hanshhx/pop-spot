package com.example.popspotbackend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.security.SecureRandom;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * 인증번호 발송 메일러.
 *
 * <p>송신자 주소는 {@code spring.mail.username} 환경변수에서 가져온다. 코드 6자리는 {@link SecureRandom} 으로 생성한다. 본문은
 * 이메일 클라이언트가 외부 CSS 를 무시하므로 인라인 스타일로 작성한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private static final int AUTH_CODE_LENGTH = 6;
    private static final String EMAIL_SUBJECT = "[POP-SPOT] 회원가입 인증번호 안내";
    private static final String EMAIL_CHARSET = "UTF-8";

    private final JavaMailSender javaMailSender;
    private final SecureRandom random = new SecureRandom();

    @Value("${spring.mail.username:noreply@popspot.co.kr}")
    private String fromAddress;

    /** 예측 불가능한 6자리 숫자 인증번호. */
    public String createNumber() {
        StringBuilder key = new StringBuilder(AUTH_CODE_LENGTH);
        for (int i = 0; i < AUTH_CODE_LENGTH; i++) {
            key.append(random.nextInt(10));
        }
        return key.toString();
    }

    public String sendMail(String toEmail) {
        String authCode = createNumber();
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, EMAIL_CHARSET);
            helper.setTo(toEmail);
            helper.setSubject(EMAIL_SUBJECT);
            helper.setText(buildHtmlBody(authCode), true);
            helper.setFrom(fromAddress);
            javaMailSender.send(message);
            return authCode;
        } catch (MessagingException e) {
            log.error("메일 발송 실패: {}", e.getClass().getSimpleName());
            // 외부 서비스(SMTP) 장애 → IllegalStateException 으로 격상.
            // GlobalExceptionHandler 가 409 로 잡아 일관된 응답 포맷 유지.
            throw new IllegalStateException("메일 발송 실패");
        }
    }

    /**
     * v2.17 — SLA / 운영 알림 등 임의 텍스트 메일 발송. 인증번호와 분리해 운영 알림 용도로만 사용.
     *
     * <p>실패 시 IllegalStateException 으로 격상하지 않고 false 만 반환 — 알림 실패가 cron 전체를 중단시키지 않게.
     */
    public boolean sendNotification(String toEmail, String subject, String plainTextBody) {
        if (toEmail == null || toEmail.isBlank()) {
            log.debug("[Email] 알림 수신처 미설정 → 발송 스킵");
            return false;
        }
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, EMAIL_CHARSET);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plainTextBody, false);
            helper.setFrom(fromAddress);
            javaMailSender.send(message);
            return true;
        } catch (Exception e) {
            log.warn("[Email] 알림 발송 실패 to={} err={}", toEmail, e.toString());
            return false;
        }
    }

    private String buildHtmlBody(String authCode) {
        return "<div style='font-family: \"Apple SD Gothic Neo\", sans-serif; background-color: #f3f4f6;"
                + " padding: 40px 20px; text-align: center;'>"
                + "<div style='max-width: 500px; margin: 0 auto; background-color: #ffffff;"
                + " border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);"
                + " text-align: left;'>"
                + "<div style='text-align: center; margin-bottom: 30px;'>"
                + "<h1 style='color: #4F46E5; font-size: 28px; font-weight: 900; margin: 0;"
                + " letter-spacing: -1px; font-style: italic;'>POP-SPOT<span style='color: #000;'>.</span></h1>"
                + "</div>"
                + "<h2 style='color: #111827; font-size: 20px; margin-bottom: 10px;'>회원가입 인증번호</h2>"
                + "<p style='color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 25px;'>"
                + "안녕하세요.<br/>POP-SPOT을 이용해 주셔서 감사합니다.<br/>"
                + "아래 인증번호 6자리를 입력하여 본인 인증을 완료해 주세요."
                + "</p>"
                + "<div style='background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;"
                + " padding: 20px; text-align: center; margin-bottom: 25px;'>"
                + "<span style='font-size: 32px; font-weight: 800; color: #4F46E5; letter-spacing: 8px;'>"
                + authCode
                + "</span>"
                + "</div>"
                + "<p style='color: #9CA3AF; font-size: 12px; margin-top: 30px;"
                + " border-top: 1px solid #E5E7EB; padding-top: 20px;'>"
                + "본 메일은 발신 전용입니다.<br/>인증번호는 3분간 유효합니다."
                + "</p>"
                + "</div>"
                + "<div style='text-align: center; margin-top: 20px;'>"
                + "<p style='color: #9CA3AF; font-size: 12px;'>© 2026 POP-SPOT. All rights reserved.</p>"
                + "</div>"
                + "</div>";
    }
}
