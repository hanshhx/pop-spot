package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 접속지 정보를 <b>실제로 흐리는지</b> 확인한다.
 *
 * <p>이 기능의 실패 방식은 둘이다 — 흐린 줄 알았는데 원본이 남거나, 너무 흐려서 접속지 구실을 못 하거나. 앞쪽이 훨씬 나쁘다. 방침에 "IP를 저장하지 않는다" 고
 * 적어 둔 서비스에서 온전한 IP가 표에 쌓이는 것이기 때문이다.
 */
class ClientIpResolverTest {

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
