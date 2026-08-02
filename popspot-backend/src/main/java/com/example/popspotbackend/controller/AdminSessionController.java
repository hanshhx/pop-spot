package com.example.popspotbackend.controller;

import com.example.popspotbackend.repository.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 본인의 세션을 한 번에 끊는 비상 스위치.
 *
 * <p><b>왜 필요한가.</b> 토큰이 샜다고 의심될 때 지금은 할 수 있는 게 없다. 비밀번호를 바꾸면 부수적으로
 * 무효화되지만(AuthService.updatePassword), 소셜 로그인 계정은 비밀번호가 없어 그 경로조차 없다. 관리자 화면은 서비스 전체를 건드릴 수 있으므로
 * <b>즉시 끊는 수단</b>이 있어야 한다.
 *
 * <p><b>무엇을 끊는가.</b> {@code tokenVersion} 을 올리면 이전에 발급된 JWT 는 매 요청마다 하는 대조에서 전부 어긋난다.
 *
 * <ul>
 *   <li>앞으로의 HTTP 요청 — <b>즉시 차단</b>
 *   <li>새 WebSocket 연결 — <b>즉시 차단</b>(CONNECT 때 대조한다)
 *   <li><b>이미 연결된 WebSocket·SSE — 끊기지 않는다.</b> 검사가 연결 시점에만 돌기 때문이다.
 * </ul>
 *
 * <p>세 번째가 이 기능의 한계다. "모든 연결이 즉시 끊긴다" 고 읽으면 안 된다 — 이미 열린 로그 스트림은 그 연결이 끝날 때까지 살아 있다. 기존 연결까지 끊는 것은
 * 연결 레지스트리를 따로 들고 있어야 해서 별도 작업이다.
 *
 * <p>실행하면 <b>누른 본인도 로그아웃된다.</b> 그게 정상이다 — 내 토큰만 남겨 두면 그 토큰이 샜을 때 아무것도 막지 못한다.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/session")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSessionController {

    private final UserRepository userRepository;

    @PostMapping("/revoke-all")
    @Transactional
    public ResponseEntity<Map<String, Object>> revokeAll(Authentication authentication) {
        String userId = authentication.getName();

        int updated = userRepository.bumpTokenVersion(userId);
        if (updated == 0) {
            // 토큰은 유효한데 그 사용자가 없다 — 탈퇴 직후 등. 조용히 성공시키면 안 된다.
            log.warn("[AdminSession] 세션 무효화 대상 없음 — userId={}", userId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("revoked", false, "message", "계정을 찾을 수 없습니다."));
        }

        // 감사 로그가 아직 없어서 여기 남긴다(A단계 이후 감사 로그로 옮긴다).
        log.info("[AdminSession] 관리자 전체 세션 무효화 — userId={}", userId);

        return ResponseEntity.ok(
                Map.of(
                        "revoked",
                        true,
                        "message",
                        "모든 기기에서 로그아웃했습니다. 이미 열려 있는 실시간 연결은 끊길 때까지 유지됩니다."));
    }
}
