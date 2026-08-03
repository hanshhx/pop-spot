package com.example.popspotbackend.dto;

import com.example.popspotbackend.config.PiiMask;
import com.example.popspotbackend.entity.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * 관리자 회원 목록 응답 DTO.
 *
 * <p>{@link User} 엔티티를 그대로 내보내면 {@code password} 등 민감 정보가 노출되므로, 관리 화면에 필요한 안전한 필드만 추린다.
 *
 * <p><b>화면이 읽지 않는 값은 담지 않는다.</b> 응답에 실린 값은 화면이 그리든 말든 브라우저까지 도착하고, 개발자도구·프록시 로그·브라우저 캐시에 그대로 남는다.
 * "안 그리니까 괜찮다" 는 성립하지 않는다.
 *
 * <p>그래서 뺀 것:
 *
 * <ul>
 *   <li>{@code picture} — 소셜 프로필 사진 주소. 관리 화면은 그리지 않는다.
 *   <li>{@code stampCount} · {@code likeCount} — 활동 카운터. 대응하는 운영 동작이 코드에 없다.
 * </ul>
 *
 * <p>이메일은 가려서 내보낸다({@code emailMasked}). 필드 이름을 {@code email} 그대로 두지 않는 이유는, 그러면 다음 사람이 이 값을 진짜 주소로
 * 알고 메일 발송에 쓰기 때문이다. 이름을 바꾸면 그런 코드가 <b>컴파일 단계에서 시끄럽게 깨진다</b> — 조용히 이상하게 도는 것보다 낫다. 전체 주소가 꼭 필요할 때는
 * 해제 엔드포인트를 쓴다.
 *
 * <p>반대로 {@code premiumExpiryDate} 는 <b>남긴다.</b> {@code isPremium} 이 계산값이 아니라 저장된 칸이고, 만료 처리는 회원이
 * 자기 마이페이지를 열 때만 돌기 때문이다({@code MyPageService.expirePremiumIfNeeded}). 즉 만료됐는데 그 뒤로 안 들어온 회원은
 * {@code isPremium} 이 참으로 남아 있다 — 결제 문의 때 이 값만 보면 틀린 답을 하게 된다. 만료일이 있어야 진짜 상태를 안다. 개인 식별에는 아무 기여도
 * 하지 않는 값이라 가릴 이유도 없다.
 */
public record AdminUserDto(
        String userId,
        String emailMasked,
        String nickname,
        String provider,
        String role,
        LocalDateTime createdAt,
        @JsonProperty("isPremium") boolean isPremium,
        LocalDateTime premiumExpiryDate) {

    /** 엔티티 → DTO. provider 가 비어 있으면 로컬 가입으로 표기. */
    public static AdminUserDto from(User u) {
        return new AdminUserDto(
                u.getUserId(),
                PiiMask.email(u.getEmail()),
                u.getNickname(),
                u.getProvider() == null ? "LOCAL" : u.getProvider(),
                u.getRole(),
                u.getCreatedAt(),
                u.isPremium(),
                u.getPremiumExpiryDate());
    }
}
