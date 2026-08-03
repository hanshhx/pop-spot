package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.entity.User;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PolicyVersionServiceTest {

    private PolicyVersionService service;

    @BeforeEach
    void setUp() {
        service = new PolicyVersionService();
        ReflectionTestUtils.setField(service, "publishedTermsVersion", "1.2");
        ReflectionTestUtils.setField(service, "publishedPrivacyVersion", "1.2");
    }

    @Test
    void 시행일_전에는_기존_회원에게_재동의를_강제하지_않는다() {
        ReflectionTestUtils.setField(service, "consentEffectiveDate", LocalDate.now().plusDays(1));
        User oldConsent = User.builder().userId("user-1").agreedTermsVersion("1.1").build();

        assertThat(service.hasRequiredConsent(oldConsent)).isTrue();
    }

    @Test
    void 시행일_전이라도_신규_소셜_계정은_동의_전까지_변경_요청을_막는다() {
        ReflectionTestUtils.setField(service, "consentEffectiveDate", LocalDate.now().plusDays(1));
        User pending =
                User.builder()
                        .userId("oauth-user")
                        .agreedTermsVersion(PolicyVersionService.PENDING_CONSENT_VERSION)
                        .agreedPrivacyVersion(PolicyVersionService.PENDING_CONSENT_VERSION)
                        .build();

        assertThat(service.hasRequiredConsent(pending)).isFalse();
    }

    @Test
    void 시행일부터는_새_약관_개인정보_나이확인을_모두_요구한다() {
        ReflectionTestUtils.setField(service, "consentEffectiveDate", LocalDate.now());
        User oldConsent = User.builder().userId("user-1").agreedTermsVersion("1.1").build();
        User currentConsent = User.builder().userId("user-2").build();
        currentConsent.recordPolicyConsent("1.2", "1.2");

        assertThat(service.hasRequiredConsent(oldConsent)).isFalse();
        assertThat(service.hasRequiredConsent(currentConsent)).isTrue();
    }

    @Test
    void 버전과_나이확인이_있어도_동의시각이_없으면_완료로_보지_않는다() {
        ReflectionTestUtils.setField(service, "consentEffectiveDate", LocalDate.now());
        User missingConsentTime =
                User.builder()
                        .userId("user-3")
                        .agreedTermsVersion("1.2")
                        .agreedPrivacyVersion("1.2")
                        .age14VerifiedAt(LocalDateTime.now())
                        .build();

        assertThat(service.hasRequiredConsent(missingConsentTime)).isFalse();
    }
}
