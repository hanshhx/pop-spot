package com.example.popspotbackend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 의견 보내기 작성 요청.
 *
 * <p>로그인 사용자는 userId 가 토큰에서 채워지므로 본 DTO 에 담지 않는다. 게스트는 답신용 이메일을 선택 입력으로 채울 수 있고, 입력 시 형식 검증만 수행한다.
 */
@Data
public class FeedbackCreateRequestDto {

    /** BUG / FEATURE / GOOD / OTHER. 화면에서 라디오 4개로 받음. */
    @NotBlank
    @Size(max = 32)
    private String category;

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    @Size(max = 4000)
    private String content;

    /** 게스트 답신용 이메일 (선택). 로그인 사용자는 비워서 보내도 됨. */
    @Email
    @Size(max = 255)
    private String guestEmail;
}
