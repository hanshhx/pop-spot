package com.example.popspotbackend.service.auth;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
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

    /** Redis 6.0 호환 원자적 GET+DEL — 같은 도전표의 동시 재사용을 막는다. */
    private static final RedisScript<String> GET_DEL_SCRIPT =
            new DefaultRedisScript<>(
                    "local v = redis.call('GET', KEYS[1]) "
                            + "if v then redis.call('DEL', KEYS[1]) end "
                            + "return v",
                    String.class);

    private static final String ISSUER = "POP-SPOT";
    private static final int TIME_STEP_SECONDS = 30;

    /**
     * "비밀번호(또는 소셜 인증)는 통과했다" 는 사실만 담는 단기 표.
     *
     * <p>이메일 로그인과 소셜 로그인이 <b>같은 표를 쓴다.</b> 따로 만들면 한쪽에만 2단계 인증이 붙는 사고가 난다 — 실제로 처음에 이메일 경로만 만들었다가
     * 소셜이 통째로 우회하는 것을 발견했다.
     */
    private static final String CHALLENGE_PREFIX = "TOTP_CHALLENGE:";

    private static final long CHALLENGE_TTL_MINUTES = 5;

    private final UserRepository userRepository;
    private final TotpService totp;
    private final TotpSecretCipher cipher;
    private final RecoveryCodeService recoveryCodes;
    private final StringRedisTemplate redisTemplate;

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
     * <p>이미 등록된 상태에서 다시 부르면 <b>새 비밀키로 덮어쓴다.</b> 폰을 바꿨을 때 쓰는 경로다. 기존 앱의 코드는 그 순간부터 안 맞는다.
     *
     * <p>그래서 이미 등록된 계정은 {@code replaceExisting=true} 를 명시해야만 진행한다. 예전엔 화면의 확인창 한 줄이 유일한 제동장치였는데, 그
     * 확인창은 <b>상태 조회가 성공했을 때만</b> 떴다. 상태 조회가 실패하면 화면이 "미등록" 으로 보이면서 확인창을 건너뛰고 곧장 이 메서드를 불러, 멀쩡히 등록돼
     * 있던 2단계 인증이 소리 없이 꺼졌다. 읽기 실패가 파괴적 동작의 유일한 가드를 없애는 구조였다 — 모르면 진행하지 않는 쪽으로 뒤집는다.
     *
     * @param replaceExisting 이미 등록된 인증기를 <b>버리겠다는 명시적 의사</b>. 화면이 사용자에게 확인받은 뒤에만 true 로 보낸다.
     */
    @Transactional
    public SetupInfo beginSetup(String userId, boolean replaceExisting) {
        User user = findUser(userId);

        // 등록을 마친 계정만 해당한다. 비밀키만 있고 아직 확인 전이면 중단된 등록이라 덮어써도 잃을 것이 없다.
        if (user.isTotpEnabled() && !replaceExisting) {
            throw new IllegalStateException(
                    "이미 2단계 인증이 등록돼 있습니다. 다시 등록하면 지금 쓰는 인증 앱의 코드는 더 이상 맞지 않습니다.");
        }

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
     * 1차 인증을 통과했다는 단기 표를 만든다. <b>이 표에는 아무 권한이 없다.</b>
     *
     * <p>이메일 로그인과 소셜 로그인이 이 메서드를 함께 쓴다. 여기에 JWT 를 주고 나중에 코드를 확인하는 방식이면 코드를 못 맞혀도 이미 로그인된 것이라 2단계
     * 인증이 무의미해진다.
     */
    public String issueChallenge(String userId) {
        String token = UUID.randomUUID().toString();
        redisTemplate
                .opsForValue()
                .set(CHALLENGE_PREFIX + token, userId, CHALLENGE_TTL_MINUTES, TimeUnit.MINUTES);
        return token;
    }

    /**
     * 표를 쓰고 없앤다. 없거나 이미 쓴 표면 {@code null}.
     *
     * <p><b>코드를 틀렸을 때도 없앤다</b>(호출부가 실패해도 다시 부르지 않는다). 남겨 두면 같은 표로 6자리를 계속 대입할 수 있어, 다시 하려면 비밀번호부터
     * 넣게 만드는 편이 안전하다.
     */
    public String consumeChallenge(String token) {
        if (token == null || token.isBlank() || token.length() > 100) return null;
        String key = CHALLENGE_PREFIX + token;
        return redisTemplate.execute(GET_DEL_SCRIPT, List.of(key));
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
