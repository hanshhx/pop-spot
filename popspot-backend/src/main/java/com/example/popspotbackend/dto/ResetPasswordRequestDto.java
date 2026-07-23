package com.example.popspotbackend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/** 비밀번호 재설정 입력에도 회원가입과 동일한 비밀번호 정책을 적용한다. */
@Data
public class ResetPasswordRequestDto {

    @NotBlank @Email private String email;

    @NotBlank
    @Pattern(regexp = SignupRequestDto.PASSWORD_REGEX, message = "영문, 숫자, 특수문자를 포함한 8~20자여야 합니다.")
    private String newPassword;
}
