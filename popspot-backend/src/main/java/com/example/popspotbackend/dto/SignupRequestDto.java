package com.example.popspotbackend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// 🔥 [임의 수정] 데이터 유효성 검증을 위한 라이브러리 추가

@Getter
@Setter
@NoArgsConstructor
public class SignupRequestDto {

    // 🔥 [13번 임의 수정] 빈 문자열 방지 및 이메일 형식 검증 추가
    @NotBlank(message = "이메일을 입력해주세요.")
    @Email(message = "올바른 이메일 형식이 아닙니다.")
    private String email;

    // 🔥 [14번 임의 수정] 비밀번호 강도 검증 (영문, 숫자, 특수문자 포함 8~20자)
    @NotBlank(message = "비밀번호를 입력해주세요.")
    @Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*#?&])[A-Za-z\\d@$!%*#?&]{8,20}$",
            message = "비밀번호는 8~20자리이며, 영문, 숫자, 특수문자를 반드시 포함해야 합니다.")
    private String password;

    // 🔥 [13번 임의 수정] 닉네임 빈칸 가입 방지
    @NotBlank(message = "닉네임을 입력해주세요.")
    private String nickname;

    // 🔥 [13번 임의 수정] 전화번호 형식 통일 (010으로 시작하는 11자리 숫자)
    @NotBlank(message = "전화번호를 입력해주세요.")
    @Pattern(regexp = "^010\\d{8}$", message = "전화번호 형식이 올바르지 않습니다. (예: 01012345678)")
    private String phoneNumber;
}
