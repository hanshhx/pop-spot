package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.auth.TotpAuthService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 2단계 인증 등록·해제.
 *
 * <p>로그인 때 코드를 확인하는 곳은 여기가 아니다({@code /api/v1/auth/login/totp}). 이쪽은 <b>이미 로그인한 관리자</b>가 자기 계정에 인증
 * 앱을 붙이거나 떼는 경로다.
 *
 * <p>등록은 두 걸음이다 — {@code /setup} 으로 QR 을 받고, 앱에 뜬 6자리를 {@code /confirm} 으로 보낸다. 확인이 끝나야 실제로 켜지고 복구
 * 코드가 나온다. 한 걸음으로 합치면 QR 만 받고 앱 등록에 실패한 사람이 그대로 잠긴다.
 */
@RestController
@RequestMapping("/api/admin/totp")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTotpController {

    private final TotpAuthService totpAuth;

    /** 지금 상태 — 화면이 켜짐/꺼짐과 남은 복구 코드를 보여 주는 데 쓴다. */
    @GetMapping("/status")
    public ResponseEntity<TotpAuthService.Status> status(Authentication authentication) {
        return ResponseEntity.ok(totpAuth.status(authentication.getName()));
    }

    /**
     * 등록 시작 — QR 내용을 돌려준다.
     *
     * <p>{@code manualKey} 는 QR 을 못 찍을 때 앱에 손으로 넣는 값이다. QR 만 주면 카메라가 안 되는 환경에서 등록할 방법이 없다.
     */
    @PostMapping("/setup")
    public ResponseEntity<TotpAuthService.SetupInfo> setup(Authentication authentication) {
        return ResponseEntity.ok(totpAuth.beginSetup(authentication.getName()));
    }

    /**
     * 등록 확인 — 앱에 뜬 6자리를 보낸다. 성공하면 <b>복구 코드가 이때 한 번만</b> 나온다.
     *
     * <p>응답을 놓치면 다시 볼 수 없다. 화면이 이를 분명히 알리고, 저장했는지 확인받아야 한다.
     */
    @PostMapping("/confirm")
    public ResponseEntity<TotpAuthService.ConfirmResult> confirm(
            @RequestBody Map<String, String> body, Authentication authentication) {
        return ResponseEntity.ok(totpAuth.confirmSetup(authentication.getName(), body.get("code")));
    }

    /** 해제 — 현재 코드나 복구 코드를 확인한 뒤에만 끈다. */
    @PostMapping("/disable")
    public ResponseEntity<Map<String, String>> disable(
            @RequestBody Map<String, String> body, Authentication authentication) {
        totpAuth.disable(authentication.getName(), body.get("code"));
        return ResponseEntity.ok(Map.of("message", "2단계 인증을 해제했습니다."));
    }
}
