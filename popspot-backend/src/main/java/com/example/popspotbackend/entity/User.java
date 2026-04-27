package com.example.popspotbackend.entity; // [코드 해석] 이 클래스가 속한 패키지의 경로를 선언합니다.

import jakarta.persistence.*; // [코드 해석] JPA(Java Persistence API)의 데이터베이스 매핑 관련 어노테이션들을 가져옵니다.
import lombok.*; // [코드 해석] 코드 다이어트를 위한 롬복(Lombok) 라이브러리를 모두 가져옵니다.
import org.hibernate.annotations.CreationTimestamp; // [코드 해석] 데이터가 생성될 때 시간을 자동으로 찍어주는 하이버네이트 기능을 가져옵니다.

import java.time.LocalDateTime; // [코드 해석] 자바의 날짜 및 시간을 다루기 위한 객체를 가져옵니다.
import java.util.UUID; // [코드 해석] 고유 식별자(UUID) 생성을 위한 객체를 가져옵니다.

@Entity // [코드 해석] 이 클래스가 데이터베이스의 실제 테이블과 1:1로 매핑되는 객체임을 스프링 부트에게 알려줍니다.
@Getter // [코드 해석] 클래스 내 모든 필드의 Getter(데이터 읽기) 메서드를 보이지 않게 자동 생성합니다.
@Builder // [코드 해석] 필드가 많을 때 객체 생성을 직관적으로 할 수 있게 도와주는 빌더 패턴을 적용합니다.
@Setter // [코드 해석] 클래스 내 모든 필드의 Setter(데이터 쓰기) 메서드를 자동 생성합니다.
@NoArgsConstructor // [코드 해석] 매개변수가 하나도 없는 기본 생성자를 자동으로 만들어줍니다. (JPA 필수)
@AllArgsConstructor // [코드 해석] 모든 필드를 매개변수로 받는 생성자를 자동으로 만들어줍니다. (@Builder 필수)
@Table(name = "USERS") // [코드 해석] 이 엔티티가 매핑될 실제 데이터베이스의 테이블 이름을 'USERS'로 고정합니다.
public class User { // [코드 해석] User 엔티티 클래스의 시작입니다.

    // [기존 entity 기능: UUID 식별자] // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    @Id // [코드 해석] 이 필드가 데이터베이스 테이블의 기본 키(Primary Key)임을 선언합니다.
    @Column(name = "USER_ID") // [코드 해석] 데이터베이스 테이블의 컬럼 이름을 'USER_ID'로 매핑합니다.
    private String userId; // [코드 해석] 유저의 고유 식별자를 저장하는 문자열 변수입니다.

    @Column(nullable = false, unique = true) // [코드 해석] 데이터베이스에 저장될 때 값이 비어있을 수 없고(null 불가), 값들이 중복될 수 없도록 제약을 겁니다.
    private String email; // [코드 해석] 유저의 이메일을 저장하는 변수입니다.

    @Column(nullable = false) // [코드 해석] 데이터베이스에 저장될 때 값이 비어있을 수 없도록 제약을 겁니다.
    private String password; // [코드 해석] 유저의 비밀번호를 저장하는 변수입니다.

    // [통합] 소셜 로그인에서 가져온 이름은 여기에 저장 // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    @Column(nullable = false) // [코드 해석] 닉네임 역시 비어있을 수 없도록 제약을 겁니다.
    private String nickname; // [코드 해석] 유저의 화면 표시 이름(닉네임)을 저장하는 변수입니다.

    // [🔥 추가된 기능] 소셜 프로필 이미지 URL // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    @Column // [코드 해석] 특별한 제약 조건 없이 필드명(picture)과 동일한 이름의 컬럼과 매핑합니다.
    private String picture; // [코드 해석] 소셜 로그인 시 받아오는 유저의 프로필 사진 URL을 저장하는 변수입니다.

    @Column(name = "PHONE_NUMBER", unique = true) // [코드 해석] 컬럼명을 'PHONE_NUMBER'로 지정하고 중복된 전화번호를 허용하지 않습니다.
    private String phoneNumber; // [코드 해석] 유저의 전화번호를 저장하는 변수입니다.

    @Column(nullable = false) // [코드 해석] 권한 값은 비어있을 수 없도록 제약을 겁니다.
    private String role; // ROLE_USER, ROLE_ADMIN // [코드 해석] 유저의 등급(일반, 관리자 등)을 저장하는 변수 및 동현님의 원본 주석입니다.

    @Column(name = "MANNER_TEMP") // [코드 해석] 데이터베이스 컬럼 이름을 'MANNER_TEMP'로 매핑합니다.
    private Double mannerTemp; // [코드 해석] 동행 기능 등에서 쓰일 유저의 매너 온도(실수형)를 저장하는 변수입니다.

    // [🔥 추가된 기능] 소셜 제공자 (google, kakao, naver) // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    private String provider; // [코드 해석] 로그인한 플랫폼이 어디인지(구글, 카카오 등) 저장하는 변수입니다.

    @CreationTimestamp // [코드 해석] 데이터베이스에 처음 저장(INSERT)될 때 현재 시간을 자동으로 찍어줍니다.
    @Column(name = "CREATED_AT", updatable = false) // [코드 해석] 컬럼명을 'CREATED_AT'으로 지정하고, 나중에 이 값이 수정되지 못하도록 잠급니다.
    private LocalDateTime createdAt; // [코드 해석] 유저의 계정 생성 일시를 저장하는 변수입니다.

    @Column(name = "IS_PREMIUM", nullable = false) // [코드 해석] 컬럼명을 'IS_PREMIUM'으로 지정하고 null을 방지합니다.
    @Builder.Default // [코드 해석] Builder로 객체를 생성할 때 아래 지정한 기본값이 무시되지 않고 들어가게 합니다.
    private boolean isPremium = false; // [코드 해석] 유저의 프리미엄(POP-PASS) 여부를 저장하며, 초기값은 무조건 false입니다.

    // 🔥 [NEW] 프리미엄 만료 날짜 추가 // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    @Column(name = "PREMIUM_EXPIRY_DATE") // [코드 해석] 컬럼명을 'PREMIUM_EXPIRY_DATE'로 지정합니다.
    private LocalDateTime premiumExpiryDate; // [코드 해석] 프리미엄 혜택이 끝나는 날짜와 시간을 저장하는 변수입니다.

    // 🔥 [수정] 혹시 모를 에러 방지를 위해 columnDefinition 추가
    @Column(name = "MEGAPHONE_COUNT", nullable = false, columnDefinition = "integer default 0") // [코드 해석] 컬럼 생성 시 기본값을 0으로 강제합니다.
    @Builder.Default // [코드 해석] 자바 코드 레벨에서의 기본값을 유지합니다.
    private int megaphoneCount = 0; // [코드 해석] 확성기 보유 개수입니다.

    // 🔥 [수정] DB 에러 해결! 기존 유저 데이터의 빈칸을 0으로 채워넣도록 columnDefinition="integer default 0" 옵션을 추가했습니다.
    @Column(name = "STAMP_COUNT", nullable = false, columnDefinition = "integer default 0") // [코드 해석] nullable 충돌을 막기 위해 DB 기본값을 0으로 설정합니다.
    @Builder.Default // [코드 해석] 자바 객체 생성 시 기본값 0을 적용하도록 설정합니다.
    private int stampCount = 0; // [코드 해석] 획득한 팝업스토어 스탬프 누적 개수입니다.

    // 🔥 [수정] DB 에러 해결! 기존 유저 데이터의 빈칸을 0으로 채워넣도록 설정.
    @Column(name = "LIKE_COUNT", nullable = false, columnDefinition = "integer default 0") // [코드 해석] nullable 충돌을 막기 위해 DB 기본값을 0으로 설정합니다.
    @Builder.Default // [코드 해석] 자바 객체 생성 시 기본값 0을 적용하도록 설정합니다.
    private int likeCount = 0; // [코드 해석] 찜한 팝업스토어 총 개수입니다.

    // 🔥 [수정] DB 에러 해결! 기존 유저 데이터의 빈칸을 0으로 채워넣도록 설정.
    @Column(name = "REVIEW_COUNT", nullable = false, columnDefinition = "integer default 0") // [코드 해석] nullable 충돌을 막기 위해 DB 기본값을 0으로 설정합니다.
    @Builder.Default // [코드 해석] 자바 객체 생성 시 기본값 0을 적용하도록 설정합니다.
    private int reviewCount = 0; // [코드 해석] 작성한 리뷰/톡 총 개수입니다.

    // [자동 생성 로직] // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    @PrePersist // [코드 해석] JPA가 이 엔티티를 데이터베이스에 영속화(INSERT)하기 직전에 이 메서드를 자동으로 실행하도록 지시합니다.
    public void generateId() { // [코드 해석] 초기 데이터가 없을 때 기본값을 세팅해 주는 메서드의 시작입니다.
        if (userId == null) { // [코드 해석] 만약 유저 아이디가 비어있는 상태라면
            userId = UUID.randomUUID().toString(); // [코드 해석] 중복될 확률이 거의 없는 랜덤한 UUID 문자열을 생성해서 아이디로 넣어줍니다.
        } // [코드 해석] 아이디 생성 분기문 종료
        if (mannerTemp == null) { // [코드 해석] 만약 유저의 매너 온도가 비어있다면
            mannerTemp = 36.5; // [코드 해석] 초기 매너 온도인 36.5도를 기본값으로 세팅합니다.
        } // [코드 해석] 온도 생성 분기문 종료
        if (role == null) { // [코드 해석] 유저의 권한 등급이 비어있는 채로 가입하려 한다면
            role = "ROLE_USER"; // Security 호환을 위해 ROLE_ 접두사 권장 // [코드 해석] 기본 등급인 일반 유저로 세팅합니다. (동현님 원본 주석 포함)
        } // [코드 해석] 권한 생성 분기문 종료
    } // [코드 해석] generateId 메서드 종료

    // [🔥 추가된 기능] 소셜 로그인 정보 업데이트 (이름/사진 변경 시 반영) // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    public User update(String name, String picture) { // [코드 해석] 소셜 프로필이 바뀌었을 때 이를 DB에도 반영하는 메서드입니다.
        this.nickname = name; // [코드 해석] 새로운 닉네임을 덮어씌웁니다.
        this.picture = picture; // [코드 해석] 새로운 프로필 사진 URL을 덮어씌웁니다.
        return this; // [코드 해석] 메서드 체이닝 방식을 위해 객체 자기 자신을 반환합니다.
    } // [코드 해석] update 메서드 종료

    public String getRoleKey() { // [코드 해석] 스프링 시큐리티에서 유저의 권한을 요구할 때 사용하기 위해 만든 메서드입니다.
        return this.role; // [코드 해석] 유저가 가지고 있는 현재 role 값(예: ROLE_USER)을 반환합니다.
    } // [코드 해석] getRoleKey 메서드 종료

    // [비즈니스 로직] // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    public void changePassword(String newPassword) { // [코드 해석] 유저가 비밀번호를 바꿀 때 호출되는 메서드입니다.
        this.password = newPassword; // [코드 해석] 입력받은 새로운 비밀번호로 기존 비밀번호를 덮어씁니다.
    } // [코드 해석] changePassword 메서드 종료

    // 기존 단순 등급업 메서드 (하위 호환성 위해 유지하거나 extendPremium으로 대체 가능) // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    public void upgradeToPremium() { // [코드 해석] 단순하게 즉시 프리미엄 회원으로 전환시키는 메서드입니다.
        this.isPremium = true; // [코드 해석] 프리미엄 상태를 true로 변경합니다.
    } // [코드 해석] upgradeToPremium 메서드 종료

    // 🔥 [수정됨] 프리미엄 기간 연장 로직 (로직 강화) // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    public void extendPremium(int days) { // [코드 해석] 프리미엄 기간을 연장하는 메서드입니다.
        LocalDateTime now = LocalDateTime.now(); // [코드 해석] 연장을 요청한 현재 시스템 시간을 가져옵니다.

        // 1. 현재 만료일이 존재하고(null 아님), 현재 시간보다 미래라면? (기간이 살아있음) // [코드 해석] 동현님이 작성하신 원본 주석입니다.
        // -> isPremium 상태와 상관없이 날짜가 살아있으면 연장해줍니다. // [코드 해석] 동현님이 작성하신 원본 주석입니다.
        if (this.premiumExpiryDate != null && this.premiumExpiryDate.isAfter(now)) { // [코드 해석] 만료일 데이터가 있고 미래라면
            this.premiumExpiryDate = this.premiumExpiryDate.plusDays(days); // [코드 해석] 기존의 남은 기간에 구매한 일수를 더해줍니다.
        } // [코드 해석] 조건문 종료
        // 2. 만료일이 없거나, 이미 지났다면? (새로 시작) // [코드 해석] 동현님이 작성하신 원본 주석입니다.
        else { // [코드 해석] 신규 가입자이거나 기간이 지난 사람이라면
            this.premiumExpiryDate = now.plusDays(days); // [코드 해석] 연장 기준점을 오늘로 잡고 더해줍니다.
        } // [코드 해석] 조건문 종료

        // 3. 상태는 무조건 활성화 // [코드 해석] 동현님이 작성하신 원본 주석입니다.
        this.isPremium = true; // [코드 해석] 프리미엄 상태를 무조건 켜줍니다(true).
    } // [코드 해석] extendPremium 메서드 종료

    public void addMegaphone(int count) { // [코드 해석] 확성기를 보상으로 주거나 구매했을 때 호출되는 메서드입니다.
        this.megaphoneCount += count; // [코드 해석] 현재 확성기 개수에 들어온 개수를 누적 합산합니다.
    } // [코드 해석] addMegaphone 메서드 종료

    // 🔥 [추가됨] 기간 만료 처리 메서드 // [코드 해석] 동현님이 작성하신 원본 주석입니다.
    public void expirePremium() { // [코드 해석] 프리미엄 기간 만료 시 호출하는 롤백 메서드입니다.
        this.isPremium = false; // [코드 해석] 프리미엄 혜택 상태를 해제합니다.
        this.premiumExpiryDate = null; // [코드 해석] 만료일자 데이터를 지웁니다.
    } // [코드 해석] expirePremium 메서드 종료
} // [코드 해석] User 클래스 종료