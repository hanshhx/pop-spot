package com.example.popspotbackend.service.admin;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.auth.TotpAuthService;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 되돌릴 수 없는 작업 직전에 <b>한 번 더</b> 본인을 확인한다.
 *
 * <p><b>토큰만으로는 부족한 이유.</b> 관리자 토큰 하나가 새면 그 토큰으로 팝업을 영구 삭제하고 채팅을 통째로 지울 수 있다. 2단계 인증은 <b>로그인할 때</b>만
 * 묻기 때문에, 로그인 이후에 토큰을 훔친 사람에게는 아무 장벽이 되지 않는다. 되돌릴 수 없는 작업 앞에 한 번 더 묻는 것이 그 구간을 메운다.
 *
 * <p><b>매번 묻지는 않는다.</b> 확인한 뒤 {@link #FRESHNESS} 동안은 통과시킨다. 삭제 한 건마다 6자리를 넣게 하면 관리자는 이 화면을 안 쓰고 DB
 * 콘솔로 간다 — 거기엔 감사도 한도도 없다. 마찰이 과하면 보안 장치가 우회를 만든다.
 *
 * <p><b>기본값은 꺼짐이다.</b> 2단계 인증 때와 같은 이유다 — 코드를 먼저 배포하고, 확인 수단이 실제로 동작하는 것을 본 뒤에 켠다. 켜진 채로 배포했는데 확인
 * 수단이 없으면 관리자가 자기 서비스에서 아무것도 못 지운다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminReauthService {

    /** 한 번 확인하면 이만큼은 다시 묻지 않는다. 짧으면 우회를 만들고, 길면 의미가 없다. */
    private static final Duration FRESHNESS = Duration.ofMinutes(10);

    private static final String KEY_PREFIX = "ADMIN_REAUTH:";

    private final UserRepository userRepository;
    private final TotpAuthService totpAuth;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.admin.reauth.enabled:false}")
    private boolean enabled;

    /** 확인 수단 — 화면이 무엇을 물어볼지 정하는 데 쓴다. */
    public enum Method {
        /** 인증 앱 6자리 또는 복구 코드. */
        TOTP,
        /** 비밀번호. */
        PASSWORD,
        /**
         * 확인할 방법이 없다 — 소셜 계정인데 2단계 인증도 등록하지 않은 경우.
         *
         * <p>이때 <b>막지 않는다.</b> 막으면 관리자가 아무것도 못 하게 되고, 고치려면 2단계 인증을 등록해야 하는데 그 화면도 관리자 영역이다. 대신 로그에
         * 크게 남겨 등록을 유도한다.
         */
        NONE
    }

    /** 이 계정이 어떤 방법으로 재확인할 수 있는가. */
    public Method methodFor(String userId) {
        User user = findUser(userId);
        if (user.isTotpEnabled()) return Method.TOTP;
        if (user.getPassword() != null && !user.getPassword().isBlank()) return Method.PASSWORD;
        return Method.NONE;
    }

    /**
     * 지금 이 사용자가 민감 작업을 해도 되는가.
     *
     * <p>기능이 꺼져 있으면 참이다. 기능이 켜진 운영 환경에서 확인 수단이 없는 계정은 민감 작업을 수행할 수 없다.
     */
    public boolean isSatisfied(String userId) {
        if (!enabled || userId == null) return true;
        if (methodFor(userId) == Method.NONE) {
            // 확인 수단이 없는 계정을 통과시키면 재인증 보호가 가장 필요한 계정에서
            // 오히려 무력화된다. 관리자는 TOTP를 등록한 뒤 민감 작업을 수행해야 한다.
            log.warn("[AdminReauth] 확인 수단이 없어 민감 작업 차단 userId={}", userId);
            return false;
        }
        return redisTemplate.hasKey(KEY_PREFIX + userId);
    }

    /**
     * 재확인 — 맞으면 {@link #FRESHNESS} 동안 유효한 표를 남긴다.
     *
     * @return 확인 성공 여부
     */
    public boolean confirm(String userId, String secret) {
        if (secret == null || secret.isBlank()) return false;

        boolean ok =
                switch (methodFor(userId)) {
                    case TOTP -> totpAuth.verifyForLogin(userId, secret);
                    case PASSWORD -> passwordEncoder.matches(
                            secret, findUser(userId).getPassword());
                    case NONE -> false;
                };

        if (!ok) {
            log.warn("[재인증] 실패 — userId={}", userId);
            return false;
        }

        redisTemplate
                .opsForValue()
                .set(KEY_PREFIX + userId, "1", FRESHNESS.toSeconds(), TimeUnit.SECONDS);
        log.info("[재인증] 성공 — userId={}", userId);
        return true;
    }

    /** 남은 유효 시간(초). 화면이 "N분 뒤 다시 물어봅니다" 를 보여 주는 데 쓴다. 없으면 0. */
    public long remainingSeconds(String userId) {
        Long ttl = redisTemplate.getExpire(KEY_PREFIX + userId, TimeUnit.SECONDS);
        return ttl == null || ttl < 0 ? 0 : ttl;
    }

    /** 표를 즉시 버린다. 전체 로그아웃 때 함께 부른다 — 세션을 끊었는데 재인증 표가 남으면 안 된다. */
    public void clear(String userId) {
        if (userId != null) redisTemplate.delete(KEY_PREFIX + userId);
    }

    public boolean isEnabled() {
        return enabled;
    }

    private User findUser(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.user(userId));
    }
}
