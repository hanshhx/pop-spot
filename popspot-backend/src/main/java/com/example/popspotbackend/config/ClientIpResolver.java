package com.example.popspotbackend.config;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 신뢰 가능한 접속 IP를 판정한다.
 *
 * <p>이 판정은 원래 {@code RateLimitInterceptor} 안에만 있었다. 감사 로그도 같은 값이 필요해지면서 꺼냈다 — 두 곳이 각자 판정하면 언젠가
 * 갈라지고, 그러면 "제한에 걸린 IP" 와 "기록된 IP" 가 달라져 사고 조사가 어긋난다.
 *
 * <p><b>헤더 이름이 아니라 서명으로 신뢰를 판단한다.</b> 앞단인 Tailscale Funnel 은 {@code X-Real-IP} 를 덮어쓰지 않아, 클라이언트가 보낸
 * 값이 그대로 여기까지 온다. 그래서 헤더를 믿으면 위조되고, 안 믿으면 전원이 같은 IP로 보여 제한이 무의미해진다. 프론트(Vercel)가 접속 IP에 HMAC 을 붙여
 * 보내고 서명이 맞을 때만 그 값을 쓴다.
 *
 * <p>아래 헤더 순서는 <b>비밀키를 설정하지 않았을 때의 기존 동작</b>이다. 켜고 끄는 것을 배포와 분리하기 위해 남겨 둔다.
 */
@Component
@RequiredArgsConstructor
public class ClientIpResolver {

    private final EdgeSignatureVerifier edgeSignature;

    @Value("${app.trust-proxy-headers:false}")
    private boolean trustProxyHeaders;

    /** 접속 IP 전체. */
    public String resolve(HttpServletRequest req) {
        if (edgeSignature.isEnabled()) {
            // 증명된 IP만 쓴다. 증명이 없으면 헤더는 보지 않는다 — 위조 경로를 닫는 지점.
            String verified = edgeSignature.verifiedIp(req);
            return verified != null ? verified : req.getRemoteAddr();
        }

        if (!trustProxyHeaders) return req.getRemoteAddr();

        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();

        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            // 앞단 프록시가 <b>덧붙인</b> 마지막 항목이 실제 접속 IP다. 첫 항목은 클라이언트가
            // 보낸 값이라 믿을 수 없다.
            String[] hops = xff.split(",");
            String last = hops[hops.length - 1].trim();
            if (!last.isEmpty()) return last;
        }
        return req.getRemoteAddr();
    }

    /**
     * 감사 기록용 — <b>정밀도를 한 단계 낮춘</b> 접속지 정보.
     *
     * <p>관리자 접속기록에는 "어디서 접속했는가" 가 필요하다. 그런데 이 서비스는 방문 로그에 IP를 저장하지 않는 것을 방침으로 내세워 왔다. 둘 사이에서, 접속지를
     * 알아볼 수 있을 만큼만 남기고 그 이상은 버린다.
     *
     * <ul>
     *   <li>IPv4 — 마지막 자리를 지운다. {@code 119.194.113.214} → {@code 119.194.113.0}
     *   <li>IPv6 — 앞 네 덩이만 남긴다. 개인 기기를 특정하는 뒷부분을 버린다.
     * </ul>
     *
     * <p>해시가 아니라 <b>자르기</b>인 이유: 해시는 같은 곳에서 왔는지는 알려 주지만 그곳이 어디인지는 알려 주지 않는다. 접속기록의 목적이 "낯선 곳에서
     * 들어왔는가" 를 판단하는 것이라, 위치가 남아야 쓸모가 있다.
     */
    public String resolveCoarse(HttpServletRequest req) {
        return coarsen(resolve(req));
    }

    /** 정밀도 낮추기. 형식을 못 알아보면 통째로 버린다 — 모르는 값을 그대로 남기지 않는다. */
    static String coarsen(String ip) {
        if (ip == null || ip.isBlank()) return null;
        String trimmed = ip.trim();

        if (trimmed.indexOf(':') >= 0) {
            String[] parts = trimmed.split(":");
            if (parts.length < 4) return null;
            return String.join(":", parts[0], parts[1], parts[2], parts[3]) + "::";
        }

        String[] octets = trimmed.split("\\.");
        if (octets.length != 4) return null;
        for (String octet : octets) {
            if (!octet.matches("\\d{1,3}")) return null;
        }
        return octets[0] + "." + octets[1] + "." + octets[2] + ".0";
    }
}
