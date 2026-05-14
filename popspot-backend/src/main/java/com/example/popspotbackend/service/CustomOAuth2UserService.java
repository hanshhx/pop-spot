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
                                                attributes.getName(), attributes.getPicture()))
                        .orElseGet(() -> buildNewUser(attributes));
        return userRepository.save(user);
    }

    private User buildNewUser(OAuthAttributes attributes) {
        return User.builder()
                .nickname(attributes.getName())
                .email(attributes.getEmail())
                .picture(attributes.getPicture())
                .role(DEFAULT_ROLE)
                .provider(attributes.getProvider())
                .password(UUID.randomUUID().toString())
                .build();
    }
}
