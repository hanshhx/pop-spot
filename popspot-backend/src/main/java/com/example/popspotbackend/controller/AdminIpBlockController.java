package com.example.popspotbackend.controller;

import com.example.popspotbackend.config.ClientIpResolver;
import com.example.popspotbackend.dto.IpBlockDto;
import com.example.popspotbackend.service.admin.IpBlockService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * D-2 — IP 임시 차단 관리.
 *
 * <p><b>이 경로는 차단 검사에서 빠져 있다</b>({@code WebConfig} 참고). 잠금 탈출구다 — 관리자의 IP 가 바뀌어 예전에 걸어 둔 주소를 다시 배정받는
 * 일이 실제로 일어날 수 있고, 그때 이 경로까지 막히면 스스로 풀 방법이 없어진다. 인증은 그대로 필요하므로 열어 둬도 위험하지 않다.
 */
@RestController
@RequestMapping("/api/admin/security/ip-blocks")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminIpBlockController {

    private final IpBlockService ipBlockService;

    private final ClientIpResolver clientIpResolver;

    /** 지금 걸려 있는 것들 — 남은 시간과 함께. */
    @GetMapping
    public ResponseEntity<List<IpBlockDto>> list() {
        return ResponseEntity.ok(ipBlockService.list());
    }

    /**
     * 차단한다.
     *
     * <p>거절하는 경우가 셋이다. 전부 <b>왜 거절했는지</b>를 돌려준다 — 그냥 400 만 주면 관리자는 자기가 뭘 잘못했는지 모른 채 다시 시도한다.
     *
     * @param minutes 몇 분. {@link IpBlockService#MIN_BLOCK}~{@link IpBlockService#MAX_BLOCK} 로 접히며,
     *     실제 적용된 값을 응답으로 돌려준다
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> block(
            @RequestBody Map<String, Object> body, HttpServletRequest request) {

        String ip = String.valueOf(body.getOrDefault("ip", "")).trim();
        String reason = String.valueOf(body.getOrDefault("reason", ""));
        Duration requested = Duration.ofMinutes(toMinutes(body.get("minutes")));

        IpBlockService.BlockOutcome outcome =
                ipBlockService.block(
                        ip, requested, reason, clientIpResolver.resolve(request), actorId());

        if (!outcome.ok()) {
            return ResponseEntity.badRequest()
                    .body(
                            Map.of(
                                    "error",
                                    outcome.refusal().name(),
                                    "message",
                                    explain(outcome.refusal())));
        }
        return ResponseEntity.ok(Map.of("ip", ip, "minutes", outcome.appliedMinutes()));
    }

    /** 거절 사유를 사람 말로. 그냥 400 만 주면 관리자는 뭘 고쳐야 할지 모른 채 다시 시도한다. */
    private static String explain(IpBlockService.Refusal refusal) {
        return switch (refusal) {
            case NOT_BLOCKABLE -> "공인 IP 주소만 차단할 수 있습니다. 내부 주소는 차단해도 효과가 없습니다.";
            case ORIGIN_UNPROVEN -> "지금 접속 경로를 증명할 수 없어 차단을 걸 수 없습니다. 본인을 막게 될 수 있습니다.";
            case SELF_BLOCK -> "지금 접속 중인 주소입니다. 이걸 막으면 본인이 잠깁니다.";
        };
    }

    /** 푼다. 기다리지 않고 즉시. */
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> unblock(@RequestParam String ip) {
        return ResponseEntity.ok(Map.of("removed", ipBlockService.unblock(ip, actorId())));
    }

    /** 숫자가 아니거나 없으면 0 — {@code clampTtl} 이 최소값으로 접는다. */
    private static long toMinutes(Object raw) {
        if (raw instanceof Number number) return number.longValue();
        try {
            return raw == null ? 0 : Long.parseLong(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String actorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || auth.getName() == null ? "(unknown)" : auth.getName();
    }
}
