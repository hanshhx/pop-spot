package com.example.popspotbackend.service.auth;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 2단계 인증의 등록·확인·검증을 모은다.
 *
 * <p><b>기능 자체를 끄고 켤 수 있다.</b> {@code app.totp.enabled} 가 거짓이면 로그인은 TOTP 를 아예 묻지 않는다 — 등록을 마친 계정이라도
 * 그렇다. 엣지 서명 때와 같은 이유다: 코드를 먼저 배포해 두고, QR 등록까지 끝낸 뒤 켠다. 문제가 생기면 환경변수 한 줄을 지우고 재시작하면 원상복구다.
 *
 * <p>이 순서가 아니면 <b>관리자가 자기 서비스에서 잠긴다.</b> 켜진 채로 배포했는데 인증 앱 등록이 안 돼 있으면 로그인할 방법이 없고, 고치려면 로그인이 필요하다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TotpAuthService {

    private static final String ISSUER = "POP-SPOT";
    private static final int TIME_STEP_SECONDS = 30;

    private final UserRepository userRepository;
    private final TotpService totp;
    private final TotpSecretCipher cipher;
    private final RecoveryCodeService recoveryCodes;

    @Value("${app.totp.enabled:false}")
    private boolean featureEnabled;

    /** 등록 시작 결과 — QR 내용과, QR 을 못 찍을 때 손으로 넣을 값. */
    public record SetupInfo(String otpauthUri, String manualKey) {}

    /** 확인 결과 — 복구 코드는 <b>이때 한 번만</b> 보여 준다. */
    public record ConfirmResult(List<String> recoveryCodes) {}

    /** 현재 상태 — 화면이 "켜짐/꺼짐" 과 남은 복구 코드를 보여 주는 데 쓴다. */
    public record Status(
            boolean featureEnabled, boolean keyReady, boolean enrolled, int recoveryRemaining) {}

    public Status status(String userId) {
        User user = findUser(userId);
        return new Status(
                featureEnabled,
                cipher.isReady(),
                user.isTotpEnabled(),
                recoveryCodes.remaining(user.getTotpRecoveryCodes()));
    }

    /**
     * 등록 시작 — 새 비밀키를 만들어 저장하고 QR 내용을 돌려준다.
     *
     * <p>이 시점에는 <b>아직 켜지 않는다</b>({@code totpEnabled=false}). 6자리 확인까지 끝나야 켠다. 그러지 않으면 QR 만 받고 앱 등록에
     * 실패한 사람이 그대로 잠긴다.
     *
     * <p>이미 등록된 상태에서 다시 부르면 <b>새 비밀키로 덮어쓴다.</b> 폰을 바꿨을 때 쓰는 경로다. 기존 앱의 코드는 그 순간부터 안 맞으므로, 화면이 이를
     * 분명히 알려야 한다.
     */
    @Transactional
    public SetupInfo beginSetup(String userId) {
        User user = findUser(userId);

        byte[] secret = totp.generateSecret();
        user.setTotpSecret(cipher.encrypt(secret));
        user.setTotpEnabled(false);
        user.setTotpLastUsedStep(null);

        log.info("[TOTP] 등록 시작 — userId={}", userId);
        return new SetupInfo(
                totp.otpauthUri(ISSUER, user.getEmail(), secret), totp.toBase32(secret));
    }

    /**
     * 등록 확인 — 인증 앱이 낸 코드가 맞으면 켜고 복구 코드를 발급한다.
     *
     * <p>복구 코드를 <b>여기서</b> 주는 이유는, 이 시점이 "앱이 실제로 동작함" 이 증명된 유일한 순간이기 때문이다. 등록 시작 때 주면 앱 등록에 실패한
     * 사람에게도 코드가 나가고, 나중에 주면 그 사이에 폰을 잃었을 때 입구가 없다.
     */
    @Transactional
    public ConfirmResult confirmSetup(String userId, String code) {
        User user = findUser(userId);

        byte[] secret = cipher.decrypt(user.getTotpSecret());
        if (secret == null) {
            throw new IllegalStateException("등록을 다시 시작해 주세요. 비밀키를 읽을 수 없습니다.");
        }
        if (!totp.verify(secret, code, Instant.now().getEpochSecond())) {
            throw new IllegalArgumentException("코드가 맞지 않습니다. 앱에 표시된 6자리를 다시 확인해 주세요.");
        }

        RecoveryCodeService.Issued issued = recoveryCodes.issue();
        user.setTotpRecoveryCodes(issued.storedHashes());
        user.setTotpEnabled(true);
        user.setTotpLastUsedStep(currentStep());

        log.info("[TOTP] 등록 완료 — userId={}", userId);
        return new ConfirmResult(issued.plainCodes());
    }

    /**
     * 해제 — 현재 코드나 복구 코드를 확인한 뒤에만 끈다.
     *
     * <p>확인 없이 끄면 토큰을 훔친 사람이 2단계 인증을 스스로 꺼 버릴 수 있어, 이 기능이 있으나 마나가 된다.
     */
    @Transactional
    public void disable(String userId, String code) {
        User user = findUser(userId);
        if (!user.isTotpEnabled()) return;

        if (!verifyCode(user, code)) {
            throw new IllegalArgumentException("코드가 맞지 않습니다.");
        }
        user.setTotpEnabled(false);
        user.setTotpSecret(null);
        user.setTotpRecoveryCodes(null);
        user.setTotpLastUsedStep(null);

        log.info("[TOTP] 해제 — userId={}", userId);
    }

    /** 로그인 때 이 사용자에게 2단계 인증을 물어야 하는가. */
    public boolean isRequiredFor(User user) {
        return featureEnabled && user != null && user.isTotpEnabled();
    }

    /**
     * 로그인 2단계 검증 — 인증 앱 코드 또는 복구 코드.
     *
     * <p>성공하면 쓴 시간 창을 기록한다. TOTP 는 한 창(30초) 안에서 여러 번 유효하므로, 기록하지 않으면 코드를 가로챈 사람이 같은 창 안에 그대로 다시 쓸 수
     * 있다.
     */
    @Transactional
    public boolean verifyForLogin(String userId, String code) {
        User user = findUser(userId);
        return verifyCode(user, code);
    }

    private boolean verifyCode(User user, String code) {
        if (code == null || code.isBlank()) return false;

        byte[] secret = cipher.decrypt(user.getTotpSecret());
        if (secret != null && totp.verify(secret, code, Instant.now().getEpochSecond())) {
            long step = currentStep();
            Long lastUsed = user.getTotpLastUsedStep();
            if (lastUsed != null && lastUsed >= step) {
                // 같은 창의 코드를 이미 썼다. 재사용이다.
                log.warn("[TOTP] 같은 시간 창의 코드 재사용 시도 — userId={}", user.getUserId());
                return false;
            }
            user.setTotpLastUsedStep(step);
            return true;
        }

        // 인증 앱이 안 되면 복구 코드. 맞으면 그 코드는 즉시 사라진다.
        String remaining = recoveryCodes.consume(user.getTotpRecoveryCodes(), code);
        if (remaining != null) {
            user.setTotpRecoveryCodes(remaining);
            int left = recoveryCodes.remaining(remaining);
            log.warn("[TOTP] 복구 코드 사용 — userId={}, 남은 개수={}", user.getUserId(), left);
            return true;
        }
        return false;
    }

    private long currentStep() {
        return Instant.now().getEpochSecond() / TIME_STEP_SECONDS;
    }

    private User findUser(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.user(userId));
    }
}
