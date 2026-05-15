package com.example.popspotbackend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 회원가입 요청 DTO.
 *
 * <p>Bean Validation 으로 각 필드의 형식·강도·필수 여부를 컨트롤러 진입 직후 검증한다. 검증 실패 시 {@link
 * com.example.popspotbackend.exception.GlobalExceptionHandler} 가 400 응답으로 변환.
 */
@Getter
@Setter
@NoArgsConstructor
public class SignupRequestDto {

    private static final String PASSWORD_REGEX =
            "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*#?&])[A-Za-z\\d@$!%*#?&]{8,20}$";
    private static final String PHONE_REGEX = "^010\\d{8}$";

    @NotBlank(message = "이메일을 입력해주세요.")
    @Email(message = "올바른 이메일 형식이 아닙니다.")
    private String email;

    @NotBlank(message = "비밀번호를 입력해주세요.")
    @Pattern(regexp = PASSWORD_REGEX, message = "비밀번호는 8~20자리이며, 영문, 숫자, 특수문자를 반드시 포함해야 합니다.")
    private String password;

    @NotBlank(message = "닉네임을 입력해주세요.")
    private String nickname;

    @NotBlank(message = "전화번호를 입력해주세요.")
    @Pattern(regexp = PHONE_REGEX, message = "전화번호 형식이 올바르지 않습니다. (예: 01012345678)")
    private String phoneNumber;
}
