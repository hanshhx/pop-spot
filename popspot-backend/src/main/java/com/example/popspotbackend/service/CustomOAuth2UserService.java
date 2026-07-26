package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.auth.OAuthAttributes;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import java.util.Collections;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

/**
 * OAuth2 로그인 핸들러 — provider 별 attributes 를 매핑해 User 를 upsert.
 *
 * <p>PII 보호를 위해 로그에는 provider 와 내부 {@code userId} 만 남기고 이메일 / 이름 / 사진은 기록하지 않는다. 신규 가입 시 비밀번호는 사용되지
 * 않으므로 UUID 로 채워 둔다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private static final String DEFAULT_ROLE = "ROLE_USER";

    /** provider 이름이 이미 쓰이는 경우 붙여 볼 순번의 상한. 넘으면 UUID 조각으로 마무리한다. */
    private static final int NICKNAME_SUFFIX_MAX = 100;

    /** provider 가 이름을 안 주는 경우의 대체 닉네임(뒤에 순번이 붙는다). */
    private static final String NICKNAME_FALLBACK = "회원";

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = new DefaultOAuth2UserService().loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        String userNameAttributeName =
                userRequest
                        .getClientRegistration()
                        .getProviderDetails()
                        .getUserInfoEndpoint()
                        .getUserNameAttributeName();

        OAuthAttributes attributes =
                OAuthAttributes.of(
                        registrationId, userNameAttributeName, oAuth2User.getAttributes());
        User user = saveOrUpdate(attributes);
        log.info("OAuth2 로그인 성공 provider={} userId={}", registrationId, user.getUserId());

        return new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority(user.getRole())),
                attributes.getAttributes(),
                attributes.getNameAttributeKey());
    }

    private User saveOrUpdate(OAuthAttributes attributes) {
        User user =
                userRepository
                        .findByEmail(attributes.getEmail())
                        .map(
                                existing ->
                                        existing.update(
                                                nicknameForExisting(existing, attributes.getName()),
                                                attributes.getPicture()))
                        .orElseGet(() -> buildNewUser(attributes));
        return userRepository.save(user);
    }

    private User buildNewUser(OAuthAttributes attributes) {
        return User.builder()
                .nickname(availableNickname(attributes.getName()))
                .email(attributes.getEmail())
                .picture(attributes.getPicture())
                .role(DEFAULT_ROLE)
                .provider(attributes.getProvider())
                .password(UUID.randomUUID().toString())
                .build();
    }

    /**
     * 신규 소셜 가입용 닉네임. provider 가 준 이름이 이미 쓰이고 있으면 뒤에 2, 3, 4 … 를 붙여 비어 있는 이름을 찾는다.
     *
     * <p>보안(v2.41): 닉네임은 채팅 발신자로 서버가 확정하는 값이라 유일해야 한다(V24 unique index). 소셜은 이름을 사용자가 provider 쪽에서
     * 자유롭게 바꿀 수 있으므로, 남의 닉네임과 같은 이름으로 가입하는 것을 여기서 막지 않으면 사칭이 그대로 통한다. 가입 자체를 실패시키면 사용자가 손쓸 방법이 없으므로
     * 거절 대신 순번을 붙인다.
     */
    private String availableNickname(String name) {
        String base = (name == null || name.isBlank()) ? NICKNAME_FALLBACK : name.trim();
        if (!userRepository.existsByNickname(base)) {
            return base;
        }
        for (int suffix = 2; suffix <= NICKNAME_SUFFIX_MAX; suffix++) {
            String candidate = base + suffix;
            if (!userRepository.existsByNickname(candidate)) {
                return candidate;
            }
        }
        // 같은 이름이 100 개까지 찬 비현실적 경우 — 충돌하지 않는 값으로 마무리해 가입 실패를 막는다.
        return base + UUID.randomUUID().toString().substring(0, 8);
    }

    /**
     * 재로그인 시 닉네임 갱신값. provider 이름을 그대로 덮어쓰던 기존 동작을 유지하되, 그 이름을 <b>다른</b> 회원이 이미 쓰고 있으면 기존 닉네임을 그대로
     * 둔다.
     *
     * <p>V24 의 unique 제약 때문에 그대로 덮어쓰면 저장이 실패해 로그인 자체가 막히고, 통과하더라도 남의 표시 이름을 빼앗는 셈이 되기 때문이다.
     */
    private String nicknameForExisting(User existing, String incoming) {
        if (incoming == null || incoming.isBlank()) {
            return existing.getNickname();
        }
        String trimmed = incoming.trim();
        if (trimmed.equals(existing.getNickname())) {
            return trimmed;
        }
        return userRepository.existsByNickname(trimmed) ? existing.getNickname() : trimmed;
    }
}
