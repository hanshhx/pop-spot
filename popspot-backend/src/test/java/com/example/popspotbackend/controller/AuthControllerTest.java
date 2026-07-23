package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.service.AuthService;
import com.example.popspotbackend.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock private AuthService authService;
    @Mock private EmailService emailService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private AuthController controller;
    private SignupRequestDto request;

    @BeforeEach
    void setUp() {
        controller = new AuthController(authService, emailService, redisTemplate);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        request = new SignupRequestDto();
        request.setEmail("new@example.com");
        request.setPassword("Password1!");
        request.setNickname("신규회원");
        request.setPhoneNumber("01012345678");
    }

    @Test
    void 회원가입은_SIGNUP_목적의_인증키가_없으면_거부한다() {
        when(valueOperations.getAndDelete("AUTH_VERIFIED:SIGNUP:new@example.com")).thenReturn(null);

        var response = controller.signup(request);

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        verify(authService, never()).signup(request);
    }

    @Test
    void 회원가입은_인증키를_원자적으로_소비한_뒤에만_진행한다() {
        when(valueOperations.getAndDelete("AUTH_VERIFIED:SIGNUP:new@example.com"))
                .thenReturn("TRUE");
        when(authService.signup(request)).thenReturn("user-1");

        var response = controller.signup(request);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        verify(valueOperations).getAndDelete("AUTH_VERIFIED:SIGNUP:new@example.com");
        verify(authService).signup(request);
    }
}
