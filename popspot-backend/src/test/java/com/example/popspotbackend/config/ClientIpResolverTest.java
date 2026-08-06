package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.config.ClientIpResolver.Trust;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 접속지 정보를 <b>실제로 흐리는지</b>, 그리고 <b>그 값을 믿어도 되는지 함께 알려 주는지</b> 확인한다.
 *
 * <p>흐리기의 실패 방식은 둘이다 — 흐린 줄 알았는데 원본이 남거나, 너무 흐려서 접속지 구실을 못 하거나. 앞쪽이 훨씬 나쁘다. 방침에 "IP를 저장하지 않는다" 고 적어
 * 둔 서비스에서 온전한 IP가 표에 쌓이는 것이기 때문이다.
 *
 * <p>신뢰 표시의 실패 방식은 하나뿐이지만 더 크다 — <b>증명되지 않은 값을 증명된 것처럼 넘기는 것</b>이다. 그 값으로 차단을 걸면 Funnel 내부 주소가 차단되어
 * 전 사용자의 업로드와 관리자 자신의 도구가 한꺼번에 막힌다.
 */
class ClientIpResolverTest {

    private static final String SECRET = "test-secret-123";

    /** Funnel 이 넘겨 주는 내부 주소. 서명이 없으면 <b>전원이</b> 이 값으로 보인다. */
    private static final String FUNNEL_ADDR = "127.0.0.1";

    private static HttpServletRequest unsigned() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn(FUNNEL_ADDR);
        return request;
    }

    /** Vercel 을 지나 온 요청 — 지금 시각으로 정상 서명된다. */
    private static HttpServletRequest signed(String ip) throws Exception {
        String timestamp = Long.toString(System.currentTimeMillis());
        String signature =
                EdgeSignatureVerifier.hexSignature(
                        SECRET.getBytes(StandardCharsets.UTF_8), ip, timestamp);

        HttpServletRequest request = unsigned();
        when(request.getHeader(EdgeSignatureVerifier.HEADER_IP)).thenReturn(ip);
        when(request.getHeader(EdgeSignatureVerifier.HEADER_TS)).thenReturn(timestamp);
        when(request.getHeader(EdgeSignatureVerifier.HEADER_SIG)).thenReturn(signature);
        return request;
    }

    private static ClientIpResolver resolverWithSignatureOn() {
        return new ClientIpResolver(new EdgeSignatureVerifier(SECRET));
    }

    private static ClientIpResolver resolverWithSignatureOff() {
        return new ClientIpResolver(new EdgeSignatureVerifier(""));
    }

    /*
     * ---------------------------------------------------------------------
     * 신뢰 표시 — 이 값을 차단에 써도 되는가.
     * ---------------------------------------------------------------------
     */

    @Test
    @DisplayName("정상 서명이면 증명됨 — 차단에 써도 되는 유일한 상태")
    void verifiedWhenSignaturePresent() throws Exception {
        ClientIpResolver.ClientIp ip = resolverWithSignatureOn().resolve(signed("119.194.113.214"));

        assertThat(ip.value()).isEqualTo("119.194.113.214");
        assertThat(ip.trust()).isEqualTo(Trust.VERIFIED);
        assertThat(ip.verified()).isTrue();
    }

    @Test
    @DisplayName("서명 체계가 켜져 있는데 서명이 없으면 '강등' — 값은 접속자가 아니라 Funnel 내부 주소다")
    void degradedWhenSignatureMissing() {
        // 업로드·백필·방문이벤트처럼 Vercel 을 안 거치는 경로가 전부 여기 해당한다.
        ClientIpResolver.ClientIp ip = resolverWithSignatureOn().resolve(unsigned());

        assertThat(ip.value()).isEqualTo(FUNNEL_ADDR);
        assertThat(ip.trust()).isEqualTo(Trust.DEGRADED);
        assertThat(ip.verified()).describedAs("강등된 값을 증명된 것으로 넘기면 차단이 전원을 막는다").isFalse();
    }

    @Test
    @DisplayName("서명 체계가 꺼져 있으면 '확인 안 함' — 강등과 구분해야 한다")
    void uncheckedWhenSignatureDisabled() {
        // 강등은 "증명 수단이 있는데 증명이 없었다" 이고, 확인 안 함은 "증명 수단 자체가 꺼져 있다" 다.
        // 둘을 뭉뚱그리면 키를 안 넣은 배포에서 기존 기록이 통째로 사라진다.
        ClientIpResolver.ClientIp ip = resolverWithSignatureOff().resolve(unsigned());

        assertThat(ip.trust()).isEqualTo(Trust.UNCHECKED);
        assertThat(ip.verified()).isFalse();
    }

    /*
     * ---------------------------------------------------------------------
     * 감사 기록 — 무엇을 접속지로 남기는가.
     * ---------------------------------------------------------------------
     */

    @Test
    @DisplayName("증명된 주소는 흐려서 접속지로 남긴다")
    void verifiedIsRecordedCoarsely() throws Exception {
        assertThat(resolverWithSignatureOn().resolveCoarse(signed("119.194.113.214")))
                .isEqualTo("119.194.113.0");
    }

    @Test
    @DisplayName("강등된 주소는 접속지로 남기지 않는다 — 내부 주소가 위치인 척하면 '낯선 곳' 판정이 무뎌진다")
    void degradedIsNotRecordedAsLocation() {
        assertThat(resolverWithSignatureOn().resolveCoarse(unsigned()))
                .describedAs("127.0.0.0 은 접속지가 아니다. 모른다고 적는 편이 정직하다")
                .isNull();
    }

    @Test
    @DisplayName("서명 체계가 꺼져 있으면 기존대로 남긴다 — 키 없이 배포해도 기록이 사라지지 않는다")
    void uncheckedPreservesLegacyRecording() {
        // 이 테스트가 없으면, APP_EDGE_SECRET 을 안 넣은 상태로 배포했을 때 감사 로그의
        // 접속지가 전부 빈칸이 되고 아무도 눈치채지 못한다.
        assertThat(resolverWithSignatureOff().resolveCoarse(unsigned())).isEqualTo("127.0.0.0");
    }

    /*
     * ---------------------------------------------------------------------
     * 흐리기 자체.
     * ---------------------------------------------------------------------
     */

    @Test
    @DisplayName("IPv4 는 마지막 자리를 지운다 — 개인 기기가 아니라 접속한 망까지만 남는다")
    void coarsensIpv4() {
        assertThat(ClientIpResolver.coarsen("119.194.113.214")).isEqualTo("119.194.113.0");
        assertThat(ClientIpResolver.coarsen("1.2.3.4")).isEqualTo("1.2.3.0");
    }

    @Test
    @DisplayName("흐린 결과에 원본 마지막 자리가 남지 않는다")
    void neverLeaksLastOctet() {
        for (String ip : new String[] {"119.194.113.214", "10.0.0.255", "203.0.113.7"}) {
            String last = ip.substring(ip.lastIndexOf('.') + 1);
            assertThat(ClientIpResolver.coarsen(ip))
                    .describedAs("원본 '%s' 의 마지막 자리 '%s' 가 남으면 안 된다", ip, last)
                    .doesNotEndWith("." + last);
        }
    }

    @Test
    @DisplayName("IPv6 는 앞 네 덩이만 남긴다 — 뒷부분이 개인 기기를 특정한다")
    void coarsensIpv6() {
        assertThat(ClientIpResolver.coarsen("2001:0db8:85a3:0000:0000:8a2e:0370:7334"))
                .isEqualTo("2001:0db8:85a3:0000::");
    }

    @Test
    @DisplayName("형식을 못 알아보면 통째로 버린다 — 모르는 값을 그대로 남기지 않는다")
    void dropsUnknownShapes() {
        assertThat(ClientIpResolver.coarsen("아무거나")).isNull();
        assertThat(ClientIpResolver.coarsen("1.2.3")).describedAs("자리가 모자람").isNull();
        assertThat(ClientIpResolver.coarsen("1.2.3.4.5")).describedAs("자리가 넘침").isNull();
        assertThat(ClientIpResolver.coarsen("1.2.3.abc")).describedAs("숫자가 아님").isNull();
        assertThat(ClientIpResolver.coarsen("::1")).describedAs("덩이가 모자람").isNull();
    }

    @Test
    @DisplayName("빈 값은 null")
    void nullForEmpty() {
        assertThat(ClientIpResolver.coarsen(null)).isNull();
        assertThat(ClientIpResolver.coarsen("   ")).isNull();
    }
}
