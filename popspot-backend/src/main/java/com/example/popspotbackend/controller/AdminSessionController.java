package com.example.popspotbackend.controller;

import com.example.popspotbackend.admin.log.LogTailService;
import com.example.popspotbackend.config.LiveConnectionRegistry;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.admin.AdminReauthService;
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
 *   <li><b>이미 열린 WebSocket·SSE — 즉시 끊는다</b>(B-5). 연결 레지스트리가 세션을 들고 있다가 여기서 닫는다.
 * </ul>
 *
 * <p>세 번째가 왜 필요한가. 토큰 검사는 <b>연결할 때 한 번</b>만 돈다. 이미 열린 세션은 그 뒤로 아무도 토큰을 다시 보지 않으므로, 끊어 주지 않으면 철회된
 * 토큰으로 연 연결이 계속 살아 있다 — 채팅을 계속 보내고, 서버 로그를 계속 받는다. "끊었다" 고 믿는 것과 실제가 어긋나는 것이 이 기능에서 가장 위험한 상태다.
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
    private final LiveConnectionRegistry connections;
    private final LogTailService logTailService;
    private final AdminReauthService reauth;

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

        // 이미 열린 연결을 실제로 끊는다. tokenVersion 만 올리면 앞으로의 요청과 새 연결만
        // 막히고, 이미 붙어 있는 세션은 계속 산다.
        // 세션을 끊었는데 재인증 표가 남으면, 다시 로그인한 사람이 확인 없이 민감 작업을 한다.
        reauth.clear(userId);

        int sockets = connections.disconnectUser(userId);
        int streams = logTailService.disconnectUser(userId);

        // 감사 표에도 남지만(인터셉터가 POST 를 전부 기록한다) 끊은 개수는 여기만 안다.
        log.info(
                "[AdminSession] 관리자 전체 세션 무효화 — userId={} 끊은 연결={} 스트림={}",
                userId,
                sockets,
                streams);

        return ResponseEntity.ok(
                Map.of(
                        "revoked",
                        true,
                        "disconnectedSockets",
                        sockets,
                        "disconnectedStreams",
                        streams,
                        "message",
                        "모든 기기에서 로그아웃했습니다. 열려 있던 실시간 연결 " + (sockets + streams) + "개도 끊었습니다."));
    }
}
