package com.example.popspotbackend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** 권리자 — 자동수집된 팝업 정보가 부정확/저작권 침해 시 takedown 요청 폼. 약관(이용약관 §10) 에 명시된 신고창구 데이터. */
@Data
public class PopupTakedownRequestDto {

    @NotBlank @Email private String requesterEmail;

    @NotBlank
    @Size(max = 500)
    private String reason;
}
