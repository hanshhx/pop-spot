package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.admin.AdminReauthService;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 되돌릴 수 없는 작업 앞의 본인 재확인. */
@RestController
@RequestMapping("/api/admin/reauth")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminReauthController {

    private final AdminReauthService reauth;

    /**
     * 지금 상태 — 화면이 <b>무엇을 물어볼지</b> 정하는 데 쓴다.
     *
     * <p>2단계 인증을 등록한 계정에는 6자리를, 이메일 가입 계정에는 비밀번호를 묻는다. 화면이 임의로 고르면 소셜 계정에 비밀번호를 물어보는 사고가 난다 — 그
     * 계정에는 비밀번호가 아예 없다.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(Authentication authentication) {
        String userId = authentication.getName();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", reauth.isEnabled());
        body.put("method", reauth.methodFor(userId).name());
        body.put("satisfied", reauth.isSatisfied(userId));
        body.put("remainingSeconds", reauth.remainingSeconds(userId));
        return ResponseEntity.ok(body);
    }

    /** 확인 — 맞으면 10분 동안 민감 작업이 통과된다. */
    @PostMapping
    public ResponseEntity<Map<String, Object>> confirm(
            @RequestBody Map<String, String> body, Authentication authentication) {

        String userId = authentication.getName();
        if (!reauth.confirm(userId, body.get("secret"))) {
            // 401 이 아니라 400 이다. 401 은 프론트의 공통 처리가 로그아웃시키는데,
            // 여기서 틀린 것은 로그인 자격이 아니라 확인값 하나다.
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("confirmed", false, "message", "확인에 실패했습니다."));
        }
        return ResponseEntity.ok(
                Map.of("confirmed", true, "remainingSeconds", reauth.remainingSeconds(userId)));
    }
}
