package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.auth.OAuthAttributes;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
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

import java.util.Collections;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // [디버깅 로그 1] 서비스 진입 확인
        System.out.println("🔥 [1] CustomOAuth2UserService.loadUser() 실행됨!");

        OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = new DefaultOAuth2UserService();
        OAuth2User oAuth2User = delegate.loadUser(userRequest);

        // [디버깅 로그 2] 소셜에서 정보 가져오기 성공
        System.out.println("🔥 [2] 소셜 로그인 정보 가져오기 성공: " + oAuth2User.getAttributes());

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        String userNameAttributeName = userRequest.getClientRegistration().getProviderDetails()
                .getUserInfoEndpoint().getUserNameAttributeName();

        // [디버깅 로그 3] 어떤 소셜인지 확인
        System.out.println("🔥 [3] 로그인 플랫폼: " + registrationId); // google, kakao, naver

        OAuthAttributes attributes = OAuthAttributes.of(registrationId, userNameAttributeName, oAuth2User.getAttributes());

        // [디버깅 로그 4] DB 저장 시도
        User user = saveOrUpdate(attributes);
        System.out.println("🔥 [5] DB 저장 완료! 저장된 유저 ID: " + user.getUserId());

        return new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority(user.getRole())),
                attributes.getAttributes(),
                attributes.getNameAttributeKey());
    }

    private User saveOrUpdate(OAuthAttributes attributes) {
        System.out.println("🔥 [4] saveOrUpdate 진입 - 이메일: " + attributes.getEmail());

        User user = userRepository.findByEmail(attributes.getEmail())
                .map(entity -> {
                    System.out.println("   -> 기존 회원입니다. 정보 업데이트 수행.");
                    return entity.update(attributes.getName(), attributes.getPicture());
                })
                .orElse(User.builder()
                        .nickname(attributes.getName())
                        .email(attributes.getEmail())
                        .picture(attributes.getPicture())
                        .role("ROLE_USER")
                        .provider(attributes.getProvider())
                        .password(UUID.randomUUID().toString())
                        .build());

        if (user.getUserId() == null) {
            System.out.println("   -> 신규 회원입니다. 새로 저장합니다.");
        }

        return userRepository.save(user);
    }
}