package com.example.popspotbackend.dto.auth;

import java.util.Map;
import lombok.Builder;
import lombok.Getter;

/**
 * OAuth2 프로바이더(Google / Kakao / Naver) 가 반환한 사용자 속성 정규화.
 *
 * <p>프로바이더마다 응답 JSON 구조가 다르다 — Google 은 최상위, Kakao 는 {@code kakao_account.profile} 안, Naver 는
 * {@code response} 안. {@link #of} 팩토리가 프로바이더별 분기 후 공통 형태로 통일한다.
 */
@Getter
public class OAuthAttributes {

    private static final String PROVIDER_GOOGLE = "google";
    private static final String PROVIDER_KAKAO = "kakao";
    private static final String PROVIDER_NAVER = "naver";

    private Map<String, Object> attributes;
    private String nameAttributeKey;
    private String name;
    private String email;
    private String picture;
    private String provider;

    @Builder
    public OAuthAttributes(
            Map<String, Object> attributes,
            String nameAttributeKey,
            String name,
            String email,
            String picture,
            String provider) {
        this.attributes = attributes;
        this.nameAttributeKey = nameAttributeKey;
        this.name = name;
        this.email = email;
        this.picture = picture;
        this.provider = provider;
    }

    public static OAuthAttributes of(
            String registrationId, String userNameAttributeName, Map<String, Object> attributes) {
        if (PROVIDER_NAVER.equals(registrationId)) {
            return ofNaver("id", attributes);
        }
        if (PROVIDER_KAKAO.equals(registrationId)) {
            return ofKakao("id", attributes);
        }
        return ofGoogle(userNameAttributeName, attributes);
    }

    private static OAuthAttributes ofGoogle(
            String userNameAttributeName, Map<String, Object> attributes) {
        return OAuthAttributes.builder()
                .name((String) attributes.get("name"))
                .email((String) attributes.get("email"))
                .picture((String) attributes.get("picture"))
                .attributes(attributes)
                .nameAttributeKey(userNameAttributeName)
                .provider(PROVIDER_GOOGLE)
                .build();
    }

    @SuppressWarnings("unchecked")
    private static OAuthAttributes ofKakao(
            String userNameAttributeName, Map<String, Object> attributes) {
        Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");

        return OAuthAttributes.builder()
                .name((String) profile.get("nickname"))
                .email((String) kakaoAccount.get("email"))
                .picture((String) profile.get("profile_image_url"))
                .attributes(attributes)
                .nameAttributeKey(userNameAttributeName)
                .provider(PROVIDER_KAKAO)
                .build();
    }

    @SuppressWarnings("unchecked")
    private static OAuthAttributes ofNaver(
            String userNameAttributeName, Map<String, Object> attributes) {
        Map<String, Object> response = (Map<String, Object>) attributes.get("response");

        return OAuthAttributes.builder()
                .name((String) response.get("name"))
                .email((String) response.get("email"))
                .picture((String) response.get("profile_image"))
                .attributes(response)
                .nameAttributeKey(userNameAttributeName)
                .provider(PROVIDER_NAVER)
                .build();
    }
}
