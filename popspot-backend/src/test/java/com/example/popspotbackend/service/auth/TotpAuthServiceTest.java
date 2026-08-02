package com.example.popspotbackend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 2단계 인증의 <b>잠김 위험</b>을 확인한다.
 *
 * <p>여기서 잘못되면 사장님이 자기 서비스에서 로그인을 못 하고, 고치려면 로그인이 필요하다. 그래서 정상 동작보다 <b>안전장치가 실제로 동작하는지</b>를 더 촘촘히 본다
 * — 기능을 끈 상태, 등록 중간 상태, 코드 재사용, 복구 코드.
 */
class TotpAuthServiceTest {

    private static final String USER_ID = "admin-1";

    /** AES-256 = 32바이트를 Base64 로. */
    private static final String KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    private UserRepository users;
    private TotpService totp;
    private TotpAuthService auth;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        totp = new TotpService();
        auth =
                new TotpAuthService(
                        users, totp, new TotpSecretCipher(KEY), new RecoveryCodeService());
        enableFeature(true);

        user = User.builder().userId(USER_ID).email("admin@popspot.co.kr").build();
        when(users.findById(anyString())).thenReturn(Optional.of(user));
    }

    private void enableFeature(boolean on) {
        ReflectionTestUtils.setField(auth, "featureEnabled", on);
    }

    /** 등록을 끝낸 상태로 만든다. 반환값은 그 시점의 유효한 코드. */
    private String enroll() {
        auth.beginSetup(USER_ID);
        byte[] secret = new TotpSecretCipher(KEY).decrypt(user.getTotpSecret());
        String code = totp.generate(secret, Instant.now().getEpochSecond() / 30);
        auth.confirmSetup(USER_ID, code);
        return code;
    }

    @Test
    @DisplayName("기능을 꺼 두면 등록을 마쳤어도 로그인에서 묻지 않는다 — 비상 탈출구")
    void featureFlagOffMeansNoPrompt() {
        enroll();
        assertThat(auth.isRequiredFor(user)).describedAs("켠 상태").isTrue();

        enableFeature(false);

        assertThat(auth.isRequiredFor(user))
                .describedAs("끄면 등록돼 있어도 안 묻는다 — 이게 잠겼을 때의 탈출구다")
                .isFalse();
    }

    @Test
    @DisplayName("등록을 시작만 하고 확인을 안 하면 아직 안 켜진다 — 중간에 멈춘 사람이 잠기면 안 된다")
    void setupWithoutConfirmDoesNotEnable() {
        auth.beginSetup(USER_ID);

        assertThat(user.isTotpEnabled()).isFalse();
        assertThat(auth.isRequiredFor(user)).isFalse();
    }

    @Test
    @DisplayName("확인까지 끝나야 켜지고, 그때 복구 코드가 나온다")
    void confirmEnablesAndIssuesRecoveryCodes() {
        auth.beginSetup(USER_ID);
        byte[] secret = new TotpSecretCipher(KEY).decrypt(user.getTotpSecret());
        String code = totp.generate(secret, Instant.now().getEpochSecond() / 30);

        TotpAuthService.ConfirmResult result = auth.confirmSetup(USER_ID, code);

        assertThat(user.isTotpEnabled()).isTrue();
        assertThat(result.recoveryCodes()).hasSize(10);
    }

    @Test
    @DisplayName("틀린 코드로는 확인이 안 된다")
    void confirmRejectsWrongCode() {
        auth.beginSetup(USER_ID);

        assertThatThrownBy(() -> auth.confirmSetup(USER_ID, "000000"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(user.isTotpEnabled()).isFalse();
    }

    @Test
    @DisplayName("같은 코드를 두 번 쓸 수 없다 — 30초 창 안에서 가로챈 코드가 재사용되면 안 된다")
    void rejectsCodeReuseInSameWindow() {
        String code = enroll();

        // 등록 확인에서 이미 이 창을 썼다.
        assertThat(auth.verifyForLogin(USER_ID, code)).describedAs("같은 창의 코드 재사용").isFalse();
    }

    @Test
    @DisplayName("복구 코드로도 통과하고, 쓴 코드는 사라진다")
    void recoveryCodeWorksOnce() {
        auth.beginSetup(USER_ID);
        byte[] secret = new TotpSecretCipher(KEY).decrypt(user.getTotpSecret());
        String setupCode = totp.generate(secret, Instant.now().getEpochSecond() / 30);
        String recovery = auth.confirmSetup(USER_ID, setupCode).recoveryCodes().get(0);

        assertThat(auth.verifyForLogin(USER_ID, recovery)).isTrue();
        assertThat(auth.verifyForLogin(USER_ID, recovery)).describedAs("두 번째는 거부").isFalse();
    }

    @Test
    @DisplayName("해제는 코드를 확인한 뒤에만 된다 — 토큰을 훔친 사람이 스스로 끄면 안 된다")
    void disableRequiresCode() {
        enroll();

        assertThatThrownBy(() -> auth.disable(USER_ID, "000000"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(user.isTotpEnabled()).describedAs("여전히 켜져 있어야 한다").isTrue();
    }

    @Test
    @DisplayName("해제하면 비밀키와 복구 코드가 함께 지워진다")
    void disableClearsEverything() {
        auth.beginSetup(USER_ID);
        byte[] secret = new TotpSecretCipher(KEY).decrypt(user.getTotpSecret());
        String recovery =
                auth.confirmSetup(
                                USER_ID, totp.generate(secret, Instant.now().getEpochSecond() / 30))
                        .recoveryCodes()
                        .get(0);

        auth.disable(USER_ID, recovery);

        assertThat(user.isTotpEnabled()).isFalse();
        assertThat(user.getTotpSecret()).isNull();
        assertThat(user.getTotpRecoveryCodes()).isNull();
    }

    @Test
    @DisplayName("암호화 키가 없으면 등록을 거부한다 — 평문 저장으로 조용히 물러나지 않는다")
    void refusesSetupWithoutEncryptionKey() {
        TotpAuthService noKey =
                new TotpAuthService(
                        users, totp, new TotpSecretCipher(""), new RecoveryCodeService());
        ReflectionTestUtils.setField(noKey, "featureEnabled", true);

        assertThatThrownBy(() -> noKey.beginSetup(USER_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("encryption-key");
    }

    @Test
    @DisplayName("재등록하면 새 비밀키로 덮어쓰고 다시 꺼진다 — 폰을 바꿨을 때 경로")
    void reSetupResetsState() {
        enroll();
        String firstSecret = user.getTotpSecret();

        auth.beginSetup(USER_ID);

        assertThat(user.getTotpSecret()).isNotEqualTo(firstSecret);
        assertThat(user.isTotpEnabled()).describedAs("확인 전까지는 꺼짐").isFalse();
    }
}
