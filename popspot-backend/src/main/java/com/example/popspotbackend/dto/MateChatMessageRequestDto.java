package com.example.popspotbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** 동행 채팅 입력. sender와 게시글은 서버가 인증 세션·경로에서 확정한다. */
@Data
public class MateChatMessageRequestDto {

    @NotBlank
    @Size(max = 1000)
    private String message;

    @Pattern(regexp = "TALK|IMAGE|FILE|PROMISE|JOIN|LEAVE")
    private String type = "TALK";

    @Size(max = 2048)
    private String fileUrl;
}
