package com.example.popspotbackend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.auth.TotpAuthService;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 재인증의 <b>잠김 위험</b>을 본다.
 *
 * <p>이 기능이 잘못되면 관리자가 아무것도 못 지우게 되고, 고치려면 관리자 화면에 들어가야 한다. 그래서 정상 동작보다 "막지 말아야 할 때 막지 않는가" 를 더 촘촘히
 * 확인한다.
 */
class AdminReauthServiceTest {

    private static final String USER_ID = "admin-1";

    private UserRepository users;
    private TotpAuthService totp;
    private PasswordEncoder passwordEncoder;
    private StringRedisTemplate redis;
    private ValueOperations<String, String> redisOps;
    private AdminReauthService service;
    private User user;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        users = mock(UserRepository.class);
        totp = mock(TotpAuthService.class);
        passwordEncoder = mock(PasswordEncoder.class);
        redis = mock(StringRedisTemplate.class);
        redisOps = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(redisOps);

        service = new AdminReauthService(users, totp, passwordEncoder, redis);
        enable(true);

        user = User.builder().userId(USER_ID).email("admin@popspot.co.kr").build();
        when(users.findById(anyString())).thenReturn(Optional.of(user));
    }

    private void enable(boolean on) {
        ReflectionTestUtils.setField(service, "enabled", on);
    }

    @Test
    @DisplayName("기능이 꺼져 있으면 무조건 통과 — 비상 탈출구")
    void disabledAlwaysPasses() {
        enable(false);
        assertThat(service.isSatisfied(USER_ID)).isTrue();
        verify(redis, never()).hasKey(anyString());
    }

    @Test
    @DisplayName("확인할 방법이 없는 계정은 막지 않는다 — 막으면 영영 못 고친다")
    void accountWithoutMeansIsNotBlocked() {
        // 소셜 가입이라 비밀번호가 없고, 2단계 인증도 등록하지 않았다.
        assertThat(service.methodFor(USER_ID)).isEqualTo(AdminReauthService.Method.NONE);
        assertThat(service.isSatisfied(USER_ID))
                .describedAs("이 상태에서 막으면 2단계 인증 등록 화면에도 못 들어간다")
                .isTrue();
    }

    @Test
    @DisplayName("2단계 인증을 등록했으면 6자리를 묻는다")
    void prefersTotpWhenEnrolled() {
        user.setTotpEnabled(true);
        user.setPassword("$2a$12$whatever");

        assertThat(service.methodFor(USER_ID))
                .describedAs("둘 다 있으면 더 강한 쪽")
                .isEqualTo(AdminReauthService.Method.TOTP);
    }

    @Test
    @DisplayName("비밀번호만 있으면 비밀번호를 묻는다")
    void fallsBackToPassword() {
        user.setPassword("$2a$12$whatever");
        assertThat(service.methodFor(USER_ID)).isEqualTo(AdminReauthService.Method.PASSWORD);
    }

    @Test
    @DisplayName("확인에 성공하면 표를 남긴다")
    void confirmStoresTicket() {
        user.setTotpEnabled(true);
        when(totp.verifyForLogin(USER_ID, "123456")).thenReturn(true);

        assertThat(service.confirm(USER_ID, "123456")).isTrue();
        verify(redisOps).set(anyString(), anyString(), anyLong(), any(TimeUnit.class));
    }

    @Test
    @DisplayName("확인에 실패하면 표를 남기지 않는다")
    void failedConfirmStoresNothing() {
        user.setTotpEnabled(true);
        when(totp.verifyForLogin(anyString(), anyString())).thenReturn(false);

        assertThat(service.confirm(USER_ID, "000000")).isFalse();
        verify(redisOps, never()).set(anyString(), anyString(), anyLong(), any(TimeUnit.class));
    }

    @Test
    @DisplayName("빈 값으로는 확인되지 않는다")
    void blankSecretIsRejected() {
        user.setTotpEnabled(true);
        assertThat(service.confirm(USER_ID, "")).isFalse();
        assertThat(service.confirm(USER_ID, null)).isFalse();
    }

    @Test
    @DisplayName("확인 수단이 없으면 확인 자체도 성공하지 않는다 — 아무 값이나 통과하면 안 된다")
    void confirmFailsWithoutMeans() {
        assertThat(service.confirm(USER_ID, "아무거나")).isFalse();
    }

    @Test
    @DisplayName("표가 있으면 통과, 없으면 막힌다")
    void satisfiedFollowsTicket() {
        user.setTotpEnabled(true);

        when(redis.hasKey(anyString())).thenReturn(true);
        assertThat(service.isSatisfied(USER_ID)).isTrue();

        when(redis.hasKey(anyString())).thenReturn(false);
        assertThat(service.isSatisfied(USER_ID)).isFalse();
    }
}
