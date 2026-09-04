package com.example.popspotbackend.config;

import com.example.popspotbackend.service.auth.OAuthAttemptStore;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * 로그인 <b>시작</b> 요청에서 PKCE 챌린지를 받아 시도 기록에 남긴다.
 *
 * <p>클라이언트(웹·앱)는 {@code /oauth2/authorization/{provider}?code_challenge=...} 로 시작한다. 여기서 그 값을
 * {@code state} 를 키로 저장해 두면, 인가 왕복이 끝난 뒤 {@link OAuth2SuccessHandler} 가 같은 {@code state} 로 찾아 교환
 * 코드에 묶을 수 있다.
 *
 * <h3>왜 우리 챌린지인가 — 제공자 PKCE 와 다르다</h3>
 *
 * <p>Spring 의 {@code oauth2Login} 도 제공자(카카오·구글)와의 사이에 PKCE 를 쓸 수 있지만, 그것은 <b>우리 서버와 제공자</b> 사이를
 * 보호한다. 여기서 막으려는 것은 <b>우리 서버가 발급한 교환 코드</b>를 가로챈 앱이 쓰는 것이라 구간이 다르다. 그래서 우리 몫의 챌린지를 따로 받는다.
 *
 * <h3>기록은 챌린지가 없어도 남긴다</h3>
 *
 * <p>{@link OAuthAttemptStore#record} 가 챌린지 없는 시도를 {@code LEGACY} 로 남긴다. 그래야 콜백에서 "구방식으로 시작했다" 와
 * "기록이 사라졌다" 가 구분된다. 둘을 섞으면 쿠키·세션을 지우는 것만으로 보호를 벗겨내는 강등 공격이 열린다.
 */
public class PkceAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    /** 클라이언트가 챌린지를 싣는 이름. RFC 7636 과 같은 이름을 쓴다. */
    static final String PARAM_CHALLENGE = "code_challenge";

    private final DefaultOAuth2AuthorizationRequestResolver delegate;
    private final OAuthAttemptStore attempts;

    public PkceAuthorizationRequestResolver(
            ClientRegistrationRepository clients,
            String authorizationRequestBaseUri,
            OAuthAttemptStore attempts) {
        this.delegate =
                new DefaultOAuth2AuthorizationRequestResolver(clients, authorizationRequestBaseUri);
        this.attempts = attempts;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return record(delegate.resolve(request), request);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientId) {
        return record(delegate.resolve(request, clientId), request);
    }

    /**
     * 인가 요청이 만들어졌으면 그 {@code state} 로 시도를 기록한다.
     *
     * <p>{@code null} 은 "이 요청은 로그인 시작이 아니다" 라는 뜻이므로 그대로 흘려보낸다.
     */
    private OAuth2AuthorizationRequest record(
            OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request) {
        if (authorizationRequest == null) return null;
        attempts.record(authorizationRequest.getState(), request.getParameter(PARAM_CHALLENGE));
        return authorizationRequest;
    }
}
