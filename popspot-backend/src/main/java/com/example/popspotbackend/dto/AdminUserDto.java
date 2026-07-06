package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * 관리자 회원 목록 응답 DTO.
 *
 * <p>{@link User} 엔티티를 그대로 내보내면 {@code password} 등 민감 정보가 노출되므로, 관리 화면에 필요한 안전한 필드만 추린다.
 */
public record AdminUserDto(
        String userId,
        String email,
        String nickname,
        String picture,
        String provider,
        String role,
        LocalDateTime createdAt,
        @JsonProperty("isPremium") boolean isPremium,
        LocalDateTime premiumExpiryDate,
        int stampCount,
        int likeCount) {

    /** 엔티티 → DTO. provider 가 비어 있으면 로컬 가입으로 표기. */
    public static AdminUserDto from(User u) {
        return new AdminUserDto(
                u.getUserId(),
                u.getEmail(),
                u.getNickname(),
                u.getPicture(),
                u.getProvider() == null ? "LOCAL" : u.getProvider(),
                u.getRole(),
                u.getCreatedAt(),
                u.isPremium(),
                u.getPremiumExpiryDate(),
                u.getStampCount(),
                u.getLikeCount());
    }
}
