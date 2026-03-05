package com.example.popspotbackend.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SignupRequestDto {
    private String email;
    private String password;
    private String nickname;
    private String phoneNumber;
}