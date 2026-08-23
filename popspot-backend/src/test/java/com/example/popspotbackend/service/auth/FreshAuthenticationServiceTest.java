package com.example.popspotbackend.service.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

class FreshAuthenticationServiceTest {

    private final FreshAuthenticationService service = new FreshAuthenticationService(10);

    @Test
    @DisplayName("최근 10분 안에 직접 인증한 세션은 민감 작업을 허용한다")
    void acceptsFreshAuthentication() {
        UsernamePasswordAuthenticationToken authentication = authenticated();
        authentication.setDetails(
                new SessionAuthenticationDetails(Instant.now().minusSeconds(9 * 60L), true));

        assertThatCode(() -> service.requireFresh(authentication)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("직접 인증한 지 10분이 지난 세션은 회원 탈퇴를 막는다")
    void rejectsStaleAuthentication() {
        UsernamePasswordAuthenticationToken authentication = authenticated();
        authentication.setDetails(
                new SessionAuthenticationDetails(Instant.now().minusSeconds(11 * 60L), true));

        assertThatThrownBy(() -> service.requireFresh(authentication))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        e ->
                                org.assertj.core.api.Assertions.assertThat(e.getStatusCode())
                                        .isEqualTo(HttpStatus.PRECONDITION_REQUIRED));
    }

    @Test
    @DisplayName("인증 시각이 없거나 미래로 조작된 세션은 거부한다")
    void rejectsMissingOrFutureAuthenticationTime() {
        UsernamePasswordAuthenticationToken missing = authenticated();
        UsernamePasswordAuthenticationToken future = authenticated();
        future.setDetails(
                new SessionAuthenticationDetails(Instant.now().plusSeconds(2 * 60L), true));

        assertThatThrownBy(() -> service.requireFresh(missing))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.requireFresh(future))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("구형 JWT 호환 시각은 일반 인증에만 쓰고 민감 작업에는 인정하지 않는다")
    void rejectsUnverifiedLegacyAuthenticationTime() {
        UsernamePasswordAuthenticationToken authentication = authenticated();
        authentication.setDetails(
                new SessionAuthenticationDetails(Instant.now().minusSeconds(60), false));

        assertThatThrownBy(() -> service.requireFresh(authentication))
                .isInstanceOf(ResponseStatusException.class);
    }

    private static UsernamePasswordAuthenticationToken authenticated() {
        return new UsernamePasswordAuthenticationToken("user-1", null, List.of());
    }
}
