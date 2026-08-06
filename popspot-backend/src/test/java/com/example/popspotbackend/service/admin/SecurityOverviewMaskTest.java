package com.example.popspotbackend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.dto.SecurityOverviewDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 보안 현황판이 <b>스스로 개인정보를 흘리지 않는지</b> 확인한다.
 *
 * <p>이 화면의 목적은 "낯선 곳에서 접속했나" 를 알려 주는 것이지 "어느 집인가" 를 보여 주는 것이 아니다. 온전한 IP 는 감사 로그 원본에 있으므로, 요약까지
 * 평문으로 복제하면 <b>같은 개인정보를 보관하는 자리만 하나 더 늘어난다.</b>
 *
 * <p>보안 화면이 보안 문제를 만드는 것은 특히 나쁘다 — 아무도 그쪽을 의심하지 않는다.
 */
class SecurityOverviewMaskTest {

    @Test
    @DisplayName("IPv4 는 마지막 덩이만 가린다 — 앞은 남겨야 낯선 곳인지 사람이 안다")
    void ipv4KeepsPrefix() {
        assertThat(SecurityOverviewService.maskIp("203.0.113.42")).isEqualTo("203.0.113.*");
        assertThat(SecurityOverviewService.maskIp("10.0.0.1")).isEqualTo("10.0.0.*");
    }

    @Test
    @DisplayName("마지막 덩이가 남으면 안 된다")
    void lastOctetNeverLeaks() {
        assertThat(SecurityOverviewService.maskIp("203.0.113.42")).doesNotContain("42");
    }

    @Test
    @DisplayName("IPv6 도 가린다 — 점이 없다고 통째로 나가면 안 된다")
    void ipv6IsMasked() {
        String out = SecurityOverviewService.maskIp("2001:db8::8a2e:370:7334");
        assertThat(out).endsWith(":*");
        assertThat(out).doesNotContain("7334");
    }

    @Test
    @DisplayName("빈 값·null 은 빈 문자열 — 화면에 'null' 이 찍히지 않게")
    void blankIsSafe() {
        assertThat(SecurityOverviewService.maskIp(null)).isEmpty();
        assertThat(SecurityOverviewService.maskIp("")).isEmpty();
        assertThat(SecurityOverviewService.maskIp("   ")).isEmpty();
    }

    /** 점도 콜론도 없는 값은 형태를 모르는 것이다. 그때는 <b>통째로 가린다</b> — 모르는 것을 그대로 내보내는 쪽이 위험하다. */
    @Test
    @DisplayName("형태를 모르는 값은 통째로 가린다")
    void unknownShapeIsFullyMasked() {
        assertThat(SecurityOverviewService.maskIp("unknown")).isEqualTo("*");
    }

    @Test
    @DisplayName("실패율은 소수 첫째 자리까지 · 0 으로 나누지 않는다")
    void failRate() {
        assertThat(SecurityOverviewDto.rate(0, 0)).isZero();
        assertThat(SecurityOverviewDto.rate(5, 0)).isZero();
        assertThat(SecurityOverviewDto.rate(1, 3)).isEqualTo(33.3);
        assertThat(SecurityOverviewDto.rate(3, 3)).isEqualTo(100.0);
    }
}
