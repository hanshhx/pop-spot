package com.example.popspotbackend.config;

import com.example.popspotbackend.service.admin.IpBlockService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * D-2 — 차단된 IP 를 돌려보낸다.
 *
 * <p><b>가장 앞에 선다.</b> 차단된 요청은 아무 비용도 쓰면 안 되고, 감사 표를 공격자의 시도로 채우지도 않아야 한다. 차단 자체가 이미 기록이다.
 *
 * <p><b>판정은 {@link IpBlockService#isBlocked} 한 곳에만 있다.</b> 여기서 다시 IP 를 해석하거나 조건을 덧붙이지 않는다 — 증명되지 않은
 * 값으로는 아무도 막지 않는다는 규칙이 두 곳에 흩어지면 언젠가 한쪽만 고쳐진다. 그 대가는 전 사용자의 업로드 정지다.
 */
@Component
@RequiredArgsConstructor
public class IpBlockInterceptor implements HandlerInterceptor {

    /**
     * 왜 막혔는지 적지 않는다.
     *
     * <p>차단됐다는 사실을 알려 주면 언제 풀리는지 재보며 기다릴 수 있다. 정상 사용자가 여기 걸릴 일은 관리자가 직접 걸었을 때뿐이라, 친절할 이유보다 안 알려 줄
     * 이유가 크다.
     */
    private static final String BLOCKED_BODY =
            "{\"error\":\"FORBIDDEN\",\"message\":\"접근이 거부되었습니다.\"}";

    private final ClientIpResolver clientIpResolver;

    private final IpBlockService ipBlockService;

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        if (!ipBlockService.isBlocked(clientIpResolver.resolve(request))) return true;

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(BLOCKED_BODY);
        return false;
    }
}
