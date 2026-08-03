package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.service.AuthService;
import com.example.popspotbackend.service.EmailService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

/**
 * 회원가입이 <b>이메일 인증키를 1회용으로 소비한 뒤에만</b> 진행되는지 확인한다.
 *
 * <p>인증키 소비 방식이 {@code opsForValue().getAndDelete()} 에서 <b>Lua GET+DEL</b> ({@code
 * redisTemplate.execute(script, keys)})로 바뀌었다. 운영 Redis 가 6.0 이라 {@code GETDEL} 명령이 없어서다. 테스트가 옛
 * 방식을 계속 mock 하고 있어 실제 코드와 어긋난 채 실패하고 있었다 — 인증 로직 자체의 문제가 아니라 테스트가 뒤처진 것이지만, CI 가 이 단계에서 멈춘다.
 *
 * <p>{@code opsForValue()} stub 도 함께 걷어냈다. 지금 signup 경로는 {@code execute} 만 쓰므로, Mockito 기본 엄격 모드에서는
 * <b>쓰이지 않는 stub 자체가 실패 사유</b>가 된다.
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private static final String VERIFIED_KEY = "AUTH_VERIFIED:SIGNUP:new@example.com";

    @Mock private AuthService authService;
    @Mock private EmailService emailService;
    @Mock private StringRedisTemplate redisTemplate;

    private AuthController controller;
    private SignupRequestDto request;

    @BeforeEach
    void setUp() {
        controller = new AuthController(authService, emailService, redisTemplate);
        request = new SignupRequestDto();
        request.setEmail("new@example.com");
        request.setPassword("Password1!");
        request.setNickname("신규회원");
        request.setPhoneNumber("01012345678");
        request.setAge14OrOlder(true);
        request.setTermsAccepted(true);
        request.setPrivacyAccepted(true);
        request.setTermsVersion("1.2");
        request.setPrivacyVersion("1.2");
    }

    /** 인증키 소비 결과를 흉내낸다. null = 키 없음(미인증), "TRUE" = 인증 완료. */
    @SuppressWarnings("unchecked")
    private void whenConsumeReturns(String value) {
        when(redisTemplate.execute(any(RedisScript.class), eq(List.of(VERIFIED_KEY))))
                .thenReturn(value);
    }

    @Test
    void 회원가입은_SIGNUP_목적의_인증키가_없으면_거부한다() {
        whenConsumeReturns(null);

        var response = controller.signup(request);

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        verify(authService, never()).signup(request);
    }

    @Test
    @SuppressWarnings("unchecked")
    void 회원가입은_인증키를_원자적으로_소비한_뒤에만_진행한다() {
        whenConsumeReturns("TRUE");
        when(authService.signup(request)).thenReturn("user-1");

        var response = controller.signup(request);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        // 읽기와 삭제가 한 번의 스크립트 실행으로 끝나야 한다(경합 시 중복 가입 방지).
        verify(redisTemplate).execute(any(RedisScript.class), eq(List.of(VERIFIED_KEY)));
        verify(authService).signup(request);
    }
}
