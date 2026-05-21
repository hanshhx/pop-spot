package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.Feedback;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 의견 보내기 단건 응답.
 *
 * <p>사용자 본인 목록과 어드민 검수 큐가 같은 모양을 쓴다. 어드민 화면에서만 보여줄 추가 필드가
 * 생기면 별도 AdminFeedbackResponseDto 로 분리 (현재는 동일 모양이라 하나로 충분).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackResponseDto {

    private Long id;
    private String userId;
    private String guestEmail;
    private String category;
    private String title;
    private String content;
    private String status;
    private String adminReply;
    private LocalDateTime createdAt;
    private LocalDateTime repliedAt;

    public static FeedbackResponseDto fromEntity(Feedback f) {
        return FeedbackResponseDto.builder()
                .id(f.getId())
                .userId(f.getUserId())
                .guestEmail(f.getGuestEmail())
                .category(f.getCategory())
                .title(f.getTitle())
                .content(f.getContent())
                .status(f.getStatus())
                .adminReply(f.getAdminReply())
                .createdAt(f.getCreatedAt())
                .repliedAt(f.getRepliedAt())
                .build();
    }
}
