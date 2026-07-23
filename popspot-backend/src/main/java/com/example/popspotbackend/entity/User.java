package com.example.popspotbackend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/**
 * 회원 엔티티. 로컬 가입과 OAuth2 (구글/카카오/네이버)를 같은 테이블에 저장한다.
 *
 * <p>{@code userId} 는 가입 시 UUID 로 자동 생성되고, 정수형 카운트 필드 ({@code megaphoneCount}, {@code stampCount},
 * {@code likeCount}, {@code reviewCount})는 DB 기본값 0 으로 강제해 기존 row 의 NULL 데이터로 인한 hibernate 매핑 에러를
 * 방지한다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "USERS")
public class User {

    private static final double INITIAL_MANNER_TEMP = 36.5;
    private static final String DEFAULT_ROLE = "ROLE_USER";

    @Id
    @Column(name = "USER_ID")
    private String userId;

    @Column(nullable = false, unique = true)
    @JsonIgnore
    private String email;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    /** 닉네임. 소셜 로그인 시 provider 의 이름이 그대로 들어온다. */
    @Column(nullable = false)
    private String nickname;

    /** 소셜 프로필 이미지 URL. */
    @Column private String picture;

    @Column(name = "PHONE_NUMBER", unique = true)
    @JsonIgnore
    private String phoneNumber;

    /** ROLE_USER / ROLE_ADMIN. Spring Security 접두사 규칙을 따른다. */
    @Column(nullable = false)
    @JsonIgnore
    private String role;

    /** 비밀번호 변경·탈퇴 시 기존 JWT를 즉시 무효화하기 위한 버전. */
    @Column(name = "TOKEN_VERSION", nullable = false)
    @Builder.Default
    @JsonIgnore
    private long tokenVersion = 0L;

    /** 탈퇴 계정은 기존 토큰과 무관하게 모든 인증을 거부한다. */
    @Column(name = "ACCOUNT_ACTIVE", nullable = false)
    @Builder.Default
    @JsonIgnore
    private boolean accountActive = true;

    @Column(name = "MANNER_TEMP")
    private Double mannerTemp;

    /** google / kakao / naver / LOCAL. */
    private String provider;

    @CreationTimestamp
    @Column(name = "CREATED_AT", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "IS_PREMIUM", nullable = false)
    @Builder.Default
    private boolean isPremium = false;

    @Column(name = "PREMIUM_EXPIRY_DATE")
    private LocalDateTime premiumExpiryDate;

    @Column(name = "MEGAPHONE_COUNT", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private int megaphoneCount = 0;

    /** v2.12 — 이번 달 동행 게시판 상단 부스트 사용 횟수. 등급별 한도와 비교 후 차감. */
    @Column(name = "BOOST_USED_COUNT", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private int boostUsedCount = 0;

    /** v2.12 — YYYY-MM 형식. 달이 바뀌면 boostUsedCount 를 0 으로 리셋. */
    @Column(name = "BOOST_PERIOD", length = 7)
    private String boostPeriod;

    /** v2.19 — 사용자가 마지막으로 동의한 약관 버전. 현재 버전과 다르면 재동의 강제. */
    @Column(name = "AGREED_TERMS_VERSION", length = 10)
    private String agreedTermsVersion;

    @Column(name = "STAMP_COUNT", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private int stampCount = 0;

    @Column(name = "LIKE_COUNT", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private int likeCount = 0;

    @Column(name = "REVIEW_COUNT", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private int reviewCount = 0;

    /** ID / 매너온도 / role 의 기본값을 INSERT 직전에 보장. */
    @PrePersist
    public void generateId() {
        if (userId == null) userId = UUID.randomUUID().toString();
        if (mannerTemp == null) mannerTemp = INITIAL_MANNER_TEMP;
        if (role == null) role = DEFAULT_ROLE;
    }

    /* ============================== 비즈니스 메서드 ============================== */

    /** OAuth2 프로필이 갱신되면 닉네임 / 사진을 업데이트한다. */
    public User update(String name, String picture) {
        this.nickname = name;
        this.picture = picture;
        return this;
    }

    @JsonIgnore
    public String getRoleKey() {
        return this.role;
    }

    public void changePassword(String newPassword) {
        this.password = newPassword;
    }

    public void upgradeToPremium() {
        this.isPremium = true;
    }

    /** 프리미엄 기간 연장. 잔여 기간이 살아있으면 그 만료일에 더하고, 만료/미가입 상태면 오늘부터 다시 시작한다. 상태 플래그는 항상 활성화된다. */
    public void extendPremium(int days) {
        LocalDateTime now = LocalDateTime.now();
        if (premiumExpiryDate != null && premiumExpiryDate.isAfter(now)) {
            this.premiumExpiryDate = premiumExpiryDate.plusDays(days);
        } else {
            this.premiumExpiryDate = now.plusDays(days);
        }
        this.isPremium = true;
    }

    public void addMegaphone(int count) {
        this.megaphoneCount += count;
    }

    /** 프리미엄 만료 처리. 상태 해제 + 만료일자 제거. */
    public void expirePremium() {
        this.isPremium = false;
        this.premiumExpiryDate = null;
    }
}
