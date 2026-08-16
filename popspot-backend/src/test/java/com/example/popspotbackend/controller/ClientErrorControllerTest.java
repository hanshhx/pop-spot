package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ClientErrorControllerTest {

    @Test
    @DisplayName("클라이언트 오류 로그에서 토큰과 이메일을 제거한다")
    void redactsSensitiveTelemetry() {
        String jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature";
        String raw = "user@example.com\nBearer secret.token-value access_token=plain&next=/ " + jwt;

        String sanitized = ClientErrorController.sanitizeTelemetry(raw, 500);

        assertThat(sanitized)
                .doesNotContain("user@example.com", "secret.token-value", "plain", jwt, "\n")
                .contains("[EMAIL]", "Bearer [REDACTED]", "access_token=[REDACTED]", "[JWT]");
    }

    @Test
    @DisplayName("오류 경로의 쿼리와 프래그먼트를 저장하지 않는다")
    void stripsQueryAndFragmentFromPath() {
        assertThat(
                        ClientErrorController.sanitizePath(
                                "/oauth/callback?code=secret&state=value#result"))
                .isEqualTo("/oauth/callback");
    }

    @Test
    @DisplayName("오류 정보는 저장 상한을 넘지 않는다")
    void truncatesTelemetry() {
        assertThat(ClientErrorController.sanitizeTelemetry("a".repeat(20), 8))
                .isEqualTo("aaaaaaaa");
    }
}
