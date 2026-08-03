package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.User;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** 공개된 정책 버전과 기존 회원에게 재동의를 강제하기 시작하는 날짜를 한곳에서 관리한다. */
@Service
public class PolicyVersionService {

    /** 소셜 로그인으로 막 생성되어 아직 어떤 정책에도 동의하지 않은 계정을 구분하는 내부 표식. */
    public static final String PENDING_CONSENT_VERSION = "PENDING";

    private static final ZoneId SERVICE_ZONE = ZoneId.of("Asia/Seoul");

    @Value("${popspot.terms.current-version:1.2}")
    private String publishedTermsVersion;

    @Value("${popspot.privacy.current-version:1.2}")
    private String publishedPrivacyVersion;

    @Value("${popspot.policy.consent-effective-date:2026-08-10}")
    private LocalDate consentEffectiveDate;

    public String publishedTermsVersion() {
        return publishedTermsVersion;
    }

    public String publishedPrivacyVersion() {
        return publishedPrivacyVersion;
    }

    public LocalDate consentEffectiveDate() {
        return consentEffectiveDate;
    }

    public boolean isReconsentEnforced() {
        return !LocalDate.now(SERVICE_ZONE).isBefore(consentEffectiveDate);
    }

    /** 시행일 전에는 기존 회원에게 유예하고, 시행일부터 세 가지 동의 증적을 모두 요구한다. */
    public boolean hasRequiredConsent(User user) {
        if (PENDING_CONSENT_VERSION.equals(user.getAgreedTermsVersion())
                || PENDING_CONSENT_VERSION.equals(user.getAgreedPrivacyVersion())) {
            return false;
        }
        if (!isReconsentEnforced()) return true;
        return publishedTermsVersion.equals(user.getAgreedTermsVersion())
                && publishedPrivacyVersion.equals(user.getAgreedPrivacyVersion())
                && user.getPolicyConsentAt() != null
                && user.getAge14VerifiedAt() != null;
    }
}
