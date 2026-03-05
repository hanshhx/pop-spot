package com.example.popspotbackend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender javaMailSender;

    // 인증번호 생성 (6자리)
    public String createNumber() {
        Random random = new Random();
        StringBuilder key = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            key.append(random.nextInt(10));
        }
        return key.toString();
    }

    // 이메일 전송 메서드 (HTML 디자인 적용)
    public String sendMail(String toEmail) {
        String authCode = createNumber(); // 인증번호 생성
        MimeMessage message = javaMailSender.createMimeMessage();

        try {
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("[POP-SPOT] 회원가입 인증번호 안내"); // 제목 약간 수정

            // 🔥 [HTML 디자인 적용]
            // 이메일 클라이언트는 CSS 파일을 못 읽으므로, 모든 스타일을 태그 안에(inline style) 넣어야 합니다.
            String body = "";
            body += "<div style='font-family: \"Apple SD Gothic Neo\", sans-serif; background-color: #f3f4f6; padding: 40px 20px; text-align: center;'>";

            // 1. 카드 컨테이너 시작
            body += "  <div style='max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: left;'>";

            // 2. 로고 영역
            body += "    <div style='text-align: center; margin-bottom: 30px;'>";
            body += "      <h1 style='color: #4F46E5; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: -1px; font-style: italic;'>POP-SPOT<span style='color: #000;'>.</span></h1>";
            body += "    </div>";

            // 3. 본문 텍스트
            body += "    <h2 style='color: #111827; font-size: 20px; margin-bottom: 10px;'>회원가입 인증번호</h2>";
            body += "    <p style='color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 25px;'>";
            body += "      안녕하세요.<br/>POP-SPOT을 이용해 주셔서 감사합니다.<br/>아래 인증번호 6자리를 입력하여 본인 인증을 완료해 주세요.";
            body += "    </p>";

            // 4. 인증번호 박스 (가장 중요)
            body += "    <div style='background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;'>";
            body += "      <span style='font-size: 32px; font-weight: 800; color: #4F46E5; letter-spacing: 8px;'>" + authCode + "</span>";
            body += "    </div>";

            // 5. 하단 안내 및 푸터
            body += "    <p style='color: #9CA3AF; font-size: 12px; margin-top: 30px; border-top: 1px solid #E5E7EB; padding-top: 20px;'>";
            body += "      본 메일은 발신 전용입니다.<br/>인증번호는 3분간 유효합니다.";
            body += "    </p>";

            body += "  </div>"; // 카드 끝

            // 6. 바깥쪽 푸터
            body += "  <div style='text-align: center; margin-top: 20px;'>";
            body += "    <p style='color: #9CA3AF; font-size: 12px;'>© 2026 POP-SPOT. All rights reserved.</p>";
            body += "  </div>";

            body += "</div>"; // 전체 배경 끝

            helper.setText(body, true); // true = HTML 모드 사용
            helper.setFrom("your-email@gmail.com"); // 🔴 본인 이메일로 설정 필수!

            javaMailSender.send(message);

            return authCode;

        } catch (MessagingException e) {
            e.printStackTrace();
            throw new RuntimeException("메일 발송 실패");
        }
    }
}