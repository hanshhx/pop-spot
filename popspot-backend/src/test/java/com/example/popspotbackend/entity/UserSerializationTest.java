package com.example.popspotbackend.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;

class UserSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 공개_직렬화에서_인증정보와_개인정보를_제외한다() {
        User user =
                User.builder()
                        .userId("user-1")
                        .nickname("팝업러")
                        .picture("/uploads/avatar/test.webp")
                        .mannerTemp(36.5)
                        .email("private@example.com")
                        .password("bcrypt-hash")
                        .phoneNumber("01012345678")
                        .role("ROLE_ADMIN")
                        .tokenVersion(7)
                        .accountActive(true)
                        .build();

        @SuppressWarnings("unchecked")
        Map<String, Object> fields = objectMapper.convertValue(user, Map.class);

        assertThat(fields)
                .containsEntry("userId", "user-1")
                .containsEntry("nickname", "팝업러")
                .doesNotContainKeys(
                        "email",
                        "password",
                        "phoneNumber",
                        "role",
                        "roleKey",
                        "tokenVersion",
                        "accountActive");
    }
}
