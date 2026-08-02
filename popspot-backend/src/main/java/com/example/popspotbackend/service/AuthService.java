package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.LoginRequestDto;
import com.example.popspotbackend.dto.LoginResponseDto;
import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.auth.TotpAuthService;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로컬 회원 가입 / 로그인 / 비밀번호 재설정 / 이메일 찾기.
 *
 * <p>로컬 로그인도 OAuth2SuccessHandler 와 동일 키로 JWT 를 발급한다 (TEMP_TOKEN 폐기). JWT 시크릿은 32 바이트 이상이어야 하며
 * {@code @PostConstruct} 에서 검증한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int JWT_SECRET_MIN_BYTES = 32;

    /* v2.17 — 로그인 시도 횟수 제한 (brute-force 방어). */
    private static final int LOGIN_MAX_ATTEMPTS = 5;
    private static final int LOGIN_LOCK_MINUTES = 15;

    /** 이메일별 최근 실패 시도 — process-local in-memory. 재시작 시 초기화. */
    // 보안(v2.22): 기존 ConcurrentHashMap 은 고유 이메일 스프레이 시 무한 증가했다. Caffeine 으로
    // 최대 크기 + 잠금 시간 경과 후 자동 만료를 둬 메모리 누수를 차단한다.
    private final Cache<String, LoginAttempt> loginAttempts =
            Caffeine.newBuilder()
                    .maximumSize(50_000)
                    .expireAfterWrite(Duration.ofMinutes(LOGIN_LOCK_MINUTES))
                    .build();

    private static final String ROLE_USER = "USER";
    private static final String PROVIDER_LOCAL = "LOCAL";
    private static final String SOCIAL_USER_ERROR_PREFIX = "SOCIAL_USER:";

    private static final String TOTP_CHALLENGE_PREFIX = "TOTP_CHALLENGE:";
    private static final long TOTP_CHALLENGE_TTL_MINUTES = 5;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TotpAuthService totpAuth;
    private final StringRedisTemplate redisTemplate;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${jwt.access-token-validity-ms:3600000}")
    private long accessTokenValidityMs;

    private Key signingKey;

    @PostConstruct
    void initJwtKey() {
        if (jwtSecret == null
                || jwtSecret.isBlank()
                || jwtSecret.getBytes(StandardCharsets.UTF_8).length < JWT_SECRET_MIN_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET 환경변수 누락/짧음 (" + JWT_SECRET_MIN_BYTES + "B+ 필요)");
        }
        this.signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    /* ============================== 가입 / 로그인 ============================== */

    @Transactional
    public String signup(SignupRequestDto requestDto) {
        if (userRepository.existsByEmail(requestDto.getEmail())) {
            // 같은 이메일로 두 번 가입을 시도하는 정상 사용자 케이스 → 입력 오류 (400).
            throw new IllegalArgumentException("이미 존재하는 이메일입니다.");
        }
        // 보안(v2.41): 닉네임 중복 검사를 이메일과 동일한 방식으로 추가한다. 닉네임은 ChatIdentityResolver 가
        // "서버가 확정한 발신자" 로 채팅에 박는 값이라, 중복을 허용하면 남의 이름 그대로 가입해 사칭해도
        // 사용자·운영자 모두 구분할 수단이 없었다. 또 탈퇴 처리(AccountDeletionService)가 닉네임으로 채팅을
        // 지우므로 동명이인이 있으면 남의 대화까지 지워진다.
        // trim 하는 이유: 중복확인 API(/api/v1/users/check-nickname)가 trim 후 검사하므로, 여기서 원본을
        // 그대로 저장하면 "중복확인은 통과했지만 공백만 다른 같은 이름" 이 만들어져 검사를 우회할 수 있다.
        String nickname = requestDto.getNickname().trim();
        if (userRepository.existsByNickname(nickname)) {
            // 문구는 중복확인 API 응답(reason)과 동일하게 맞춰 프론트 안내가 갈리지 않게 한다.
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }
        User user =
                User.builder()
                        .email(requestDto.getEmail())
                        .password(passwordEncoder.encode(requestDto.getPassword()))
                        .nickname(nickname)
                        .phoneNumber(requestDto.getPhoneNumber())
                        .role(ROLE_USER)
                        .provider(PROVIDER_LOCAL)
                        .build();
        return userRepository.save(user).getUserId();
    }

    @Transactional(readOnly = true)
    public LoginResponseDto login(LoginRequestDto requestDto) {
        String email = requestDto.getEmail();
        ensureNotLocked(email);

        User user;
        try {
            user = findByEmailOrThrow(email);
        } catch (RuntimeException e) {
            recordFailure(email);
            // 보안(v2.22): 미가입 이메일도 비밀번호 불일치와 "동일한" 메시지로 응답해야 계정 존재
            // 여부가 새지 않는다(user enumeration 차단). 이전엔 "가입되지 않은 이메일입니다" 로 달라
            // 가입 여부가 식별됐다.
            throw new IllegalArgumentException("이메일 또는 비밀번호가 일치하지 않습니다.");
        }

        if (!passwordEncoder.matches(requestDto.getPassword(), user.getPassword())) {
            recordFailure(email);
            // 자격증명 실패 → 400 (의도적으로 "이메일/비밀번호 둘 중 어느 쪽이 틀렸는지" 알려주지 않는다).
            throw new IllegalArgumentException("이메일 또는 비밀번호가 일치하지 않습니다.");
        }

        if (!user.isAccountActive()) {
            throw new IllegalArgumentException("비활성화된 계정입니다.");
        }

        // 성공 시 카운터 초기화.
        loginAttempts.invalidate(email);

        // 비밀번호는 맞았다. 2단계 인증이 켜져 있으면 여기서 멈추고 표만 준다 —
        // 이 표에는 아무 권한이 없다. JWT 를 먼저 주고 나중에 코드를 확인하는 방식이면
        // 코드를 못 맞혀도 이미 로그인된 것이라 2단계 인증이 무의미해진다.
        if (totpAuth.isRequiredFor(user)) {
            return LoginResponseDto.builder()
                    .totpRequired(true)
                    .challengeToken(issueChallenge(user.getUserId()))
                    .build();
        }

        return LoginResponseDto.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .role(user.getRole())
                .isPremium(user.isPremium())
                .megaphoneCount(user.getMegaphoneCount())
                .token(issueJwt(user))
                .build();
    }

    /**
     * v2.17 — 잠금 검사. {@link #LOGIN_MAX_ATTEMPTS} 회 연속 실패 시 {@link #LOGIN_LOCK_MINUTES} 분 동안 잠금. 잠금이
     * 만료되면 카운터를 0 으로 리셋.
     */
    private void ensureNotLocked(String email) {
        if (email == null) return;
        LoginAttempt attempt = loginAttempts.getIfPresent(email);
        if (attempt == null) return;
        if (attempt.count() < LOGIN_MAX_ATTEMPTS) return;

        LocalDateTime unlockAt = attempt.lastFailedAt().plusMinutes(LOGIN_LOCK_MINUTES);
        if (LocalDateTime.now().isBefore(unlockAt)) {
            long remainingMinutes = Duration.between(LocalDateTime.now(), unlockAt).toMinutes() + 1;
            throw new IllegalArgumentException(
                    "로그인 시도가 너무 많습니다. " + remainingMinutes + "분 후 다시 시도해 주세요.");
        }
        // 잠금 만료 → 카운터 리셋.
        loginAttempts.invalidate(email);
    }

    private void recordFailure(String email) {
        if (email == null) return;
        LoginAttempt prev = loginAttempts.getIfPresent(email);
        int nextCount = (prev == null ? 0 : prev.count()) + 1;
        LoginAttempt now = new LoginAttempt(nextCount, LocalDateTime.now());
        loginAttempts.put(email, now);
        if (now.count() >= LOGIN_MAX_ATTEMPTS) {
            log.warn("[Auth] 로그인 실패 누적 {}회 → {}분 잠금 — email 마스킹됨", now.count(), LOGIN_LOCK_MINUTES);
        }
    }

    private record LoginAttempt(int count, LocalDateTime lastFailedAt) {}

    @Transactional(readOnly = true)
    public boolean checkEmailExists(String email) {
        return userRepository.existsByEmail(email);
    }

    /* ============================== 아이디 / 비밀번호 찾기 ============================== */

    @Transactional(readOnly = true)
    public String findEmailByPhoneNumber(String phoneNumber) {
        return userRepository
                .findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new ResourceNotFoundException("해당 번호로 가입된 유저가 없습니다."))
                .getEmail();
    }

    /** 닉네임 + 전화번호로 이메일 + provider 를 함께 반환 (프론트에서 소셜 여부 안내용). */
    @Transactional(readOnly = true)
    public Map<String, String> findEmailByNameAndPhone(String nickname, String phoneNumber) {
        User user =
                userRepository
                        .findByNicknameAndPhoneNumber(nickname, phoneNumber)
                        .orElseThrow(() -> new ResourceNotFoundException("일치하는 회원 정보가 없습니다."));
        Map<String, String> result = new HashMap<>();
        result.put("email", maskEmail(user.getEmail()));
        result.put("provider", user.getProvider() == null ? PROVIDER_LOCAL : user.getProvider());
        return result;
    }

    /**
     * 비밀번호 재설정 전 검증. 소셜 가입 사용자는 비밀번호가 존재하지 않으므로 차단하고 {@code SOCIAL_USER:<provider>} 형태의 에러로 컨트롤러에
     * 전달해 프론트가 안내 메시지를 띄울 수 있게 한다.
     */
    @Transactional(readOnly = true)
    public void checkUserForPasswordReset(String email, String nickname) {
        User user = findByEmailOrThrow(email);
        if (!user.getNickname().equals(nickname)) {
            // 이메일은 맞으나 닉네임이 안 맞을 때 — 입력 오류로 분류 (400).
            throw new IllegalArgumentException("이름이 일치하지 않습니다.");
        }
        String provider = user.getProvider();
        if (provider != null && !PROVIDER_LOCAL.equals(provider) && !"null".equals(provider)) {
            // 소셜 가입자라 비밀번호가 없는 경우 — 컨트롤러가 메시지 prefix 로 분기해 안내 메시지 표시.
            // GlobalExceptionHandler 의 RuntimeException 핸들러(400) 가 그대로 잡도록 유지.
            throw new RuntimeException(SOCIAL_USER_ERROR_PREFIX + provider);
        }
    }

    @Transactional
    public void updatePassword(String email, String newPassword) {
        User user = findByEmailOrThrow(email);
        user.changePassword(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1);
    }

    /* ============================== 내부 헬퍼 ============================== */

    private User findByEmailOrThrow(String email) {
        return userRepository
                .findByEmail(email)
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));
    }

    /** userId 로 User 엔티티 조회. 없으면 {@link ResourceNotFoundException} 으로 변환 (컨트롤러 → 404). */
    public User findUser(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.user(userId));
    }

    /** OAuth2SuccessHandler 와 동일한 형식의 JWT 발급. */
    /**
     * 2단계 인증 완료 — 코드를 맞히면 그때 진짜 토큰을 준다.
     *
     * <p>표는 <b>한 번 쓰면 사라진다.</b> 코드를 틀렸을 때도 마찬가지다 — 남겨 두면 같은 표로 6자리를 계속 대입할 수 있어 레이트리밋만으로는 부족해진다. 다시
     * 하려면 비밀번호부터 다시 넣어야 한다.
     */
    public LoginResponseDto completeTotpLogin(String challengeToken, String code) {
        String userId = consumeChallenge(challengeToken);
        if (userId == null) {
            throw new IllegalArgumentException("인증 시간이 지났습니다. 다시 로그인해 주세요.");
        }
        if (!totpAuth.verifyForLogin(userId, code)) {
            throw new IllegalArgumentException("코드가 맞지 않습니다. 다시 로그인해 주세요.");
        }

        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        if (!user.isAccountActive()) {
            throw new IllegalArgumentException("비활성화된 계정입니다.");
        }

        return LoginResponseDto.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .role(user.getRole())
                .isPremium(user.isPremium())
                .megaphoneCount(user.getMegaphoneCount())
                .token(issueJwt(user))
                .build();
    }

    /** 비밀번호를 맞혔다는 사실만 담는 단기 표. 5분이면 코드를 입력하기에 충분하다. */
    private String issueChallenge(String userId) {
        String token = UUID.randomUUID().toString();
        redisTemplate
                .opsForValue()
                .set(
                        TOTP_CHALLENGE_PREFIX + token,
                        userId,
                        TOTP_CHALLENGE_TTL_MINUTES,
                        TimeUnit.MINUTES);
        return token;
    }

    /** 표를 쓰고 없앤다. 없거나 이미 쓴 표면 null. */
    private String consumeChallenge(String token) {
        if (token == null || token.isBlank() || token.length() > 100) return null;
        String key = TOTP_CHALLENGE_PREFIX + token;
        String userId = redisTemplate.opsForValue().get(key);
        redisTemplate.delete(key);
        return userId;
    }

    private String issueJwt(User user) {
        return Jwts.builder()
                .setSubject(user.getUserId())
                .claim("role", user.getRole())
                .claim("ver", user.getTokenVersion())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + accessTokenValidityMs))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    private String maskEmail(String email) {
        int at = email == null ? -1 : email.indexOf('@');
        if (at <= 0) return "***";
        String local = email.substring(0, at);
        String visible = local.substring(0, Math.min(2, local.length()));
        return visible + "***" + email.substring(at);
    }
}
