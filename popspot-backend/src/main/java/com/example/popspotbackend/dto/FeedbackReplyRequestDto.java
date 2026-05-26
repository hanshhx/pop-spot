package com.example.popspotbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 어드민이 답변 + 상태 변경을 동시에 보낼 때 쓰는 DTO.
 *
 * <p>답변만 저장하고 상태는 유지하고 싶을 때도 있고, 상태만 바꾸고 싶을 때도 있으므로 둘 다 선택값. 단 둘 다 비어 있는 요청은 서비스 단에서 거부.
 */
@Data
public class FeedbackReplyRequestDto {

    /** 답변 본문. 비워 두면 답변 미작성 (상태만 변경하는 케이스). */
    @Size(max = 4000)
    private String adminReply;

    /** PENDING / REVIEWING / RESOLVED / WONT_FIX. 비우면 기존 상태 유지. */
    @NotBlank
    @Size(max = 32)
    private String status;
}
