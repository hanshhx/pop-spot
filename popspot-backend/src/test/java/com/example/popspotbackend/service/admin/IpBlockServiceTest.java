package com.example.popspotbackend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.config.ClientIpResolver.ClientIp;
import com.example.popspotbackend.config.ClientIpResolver.Trust;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * IP 임시 차단 — <b>잘못 걸리면 본인이 잠기는</b> 기능이라 안전장치부터 고정한다.
 *
 * <p>이 기능의 실패 방식은 "못 막는 것" 이 아니라 <b>"엉뚱한 것을 막는 것"</b> 이다. 증명되지 않은 주소로 차단이 걸리면 서명 없는 경로가 전부 같은 값을 쓰기
 * 때문에 전 사용자의 업로드와 관리자 자신의 도구가 한꺼번에 막힌다. 게다가 그 값은 Funnel 주소를 직접 때리면 아무나 만들 수 있어, 자동이든 수동이든 <b>공격자에게
 * 정지 버튼을 쥐여 주는</b> 꼴이 된다.
 */
class IpBlockServiceTest {

    private static ClientIp verified(String ip) {
        return new ClientIp(ip, Trust.VERIFIED);
    }

    private static ClientIp degraded(String ip) {
        return new ClientIp(ip, Trust.DEGRADED);
    }

    /*
     * ---------------------------------------------------------------------
     * 판정 — 누구를 막는가.
     * ---------------------------------------------------------------------
     */

    /**
     * <b>저장소가 "차단됨" 이라고 답하게 해 둔다.</b> 그래도 막으면 안 된다.
     *
     * <p>Redis 를 주지 않는 방식으로 쓰면 안 된다 — {@code isBlocked} 에는 통과 우선 예외 처리가 있어서, 안전장치를 빼도 {@code
     * NullPointerException} 이 삼켜지고 그대로 {@code false} 가 나온다. 즉 <b>고장난 코드도 통과하는 테스트</b>가 된다. 실제로 처음에
     * 그렇게 썼다.
     */
    @Test
    @DisplayName("증명 안 된 주소는 차단 목록에 있어도 막지 않는다")
    void neverBlocksUnverifiedIp() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.hasKey(anyString())).thenReturn(true);

        assertThat(new IpBlockService(redis).isBlocked(degraded("203.0.113.42")))
                .describedAs("서명 없는 경로는 전원이 같은 값을 쓴다 — 여기서 막으면 한 명이 아니라 전부가 막힌다")
                .isFalse();
    }

    @Test
    @DisplayName("증명된 주소가 목록에 있으면 막는다")
    void blocksVerifiedIpThatIsListed() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.hasKey(anyString())).thenReturn(true);

        assertThat(new IpBlockService(redis).isBlocked(verified("203.0.113.42"))).isTrue();
    }

    @Test
    @DisplayName("저장소가 죽으면 통과시킨다 — 차단 장치가 사이트를 멈추면 안 된다")
    void failsOpenWhenStoreIsDown() {
        // Redis 가 잠깐 안 되는 것과 사이트가 죽는 것을 맞바꿀 수 없다. 차단은 부가 기능이다.
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.hasKey(anyString())).thenThrow(new RuntimeException("redis down"));

        assertThat(new IpBlockService(redis).isBlocked(verified("203.0.113.42"))).isFalse();
    }

    /*
     * ---------------------------------------------------------------------
     * 무엇을 막을 수 있는가.
     * ---------------------------------------------------------------------
     */

    @Test
    @DisplayName("내부 주소는 막을 수 없다 — 막아도 효과가 없는데 막힌 줄 알게 된다")
    void refusesInternalAddresses() {
        for (String internal :
                new String[] {
                    "127.0.0.1",
                    "10.0.0.1",
                    "192.168.1.1",
                    "172.16.0.1",
                    "0.0.0.0",
                    "169.254.1.1",
                    "::1"
                }) {
            assertThat(IpBlockService.isBlockable(internal))
                    .describedAs("'%s' 는 차단해도 아무 일도 일어나지 않는다", internal)
                    .isFalse();
        }
    }

    @Test
    @DisplayName("공인 주소는 막을 수 있다")
    void allowsPublicAddresses() {
        assertThat(IpBlockService.isBlockable("203.0.113.42")).isTrue();
        assertThat(IpBlockService.isBlockable("2001:db8::1")).isTrue();
    }

    @Test
    @DisplayName("호스트 이름은 받지 않는다 — 이름을 받으면 DNS 를 타게 된다")
    void refusesHostnames() {
        // 관리자가 넣은 값이라도 이름을 그대로 풀면 우리 서버가 임의 도메인을 조회하게 된다.
        assertThat(IpBlockService.isBlockable("example.com")).isFalse();
        assertThat(IpBlockService.isBlockable("cafe.dad")).isFalse();
        assertThat(IpBlockService.isBlockable("")).isFalse();
        assertThat(IpBlockService.isBlockable(null)).isFalse();
        assertThat(IpBlockService.isBlockable("999.999.999.999")).isFalse();
    }

    /*
     * ---------------------------------------------------------------------
     * 자기 자신을 잠그지 않는가.
     * ---------------------------------------------------------------------
     */

    @Test
    @DisplayName("지금 접속 중인 주소는 막을 수 없다 — 가장 흔한 사고")
    void refusesToBlockSelf() {
        assertThat(IpBlockService.canBlockSafely(verified("203.0.113.42"), "203.0.113.42"))
                .isFalse();
        assertThat(IpBlockService.canBlockSafely(verified("203.0.113.42"), "198.51.100.7"))
                .isTrue();
    }

    @Test
    @DisplayName("요청자 위치를 증명 못 하면 아무것도 못 막는다 — 자기 자신인지 확인할 방법이 없다")
    void refusesWhenRequesterLocationIsUnproven() {
        // 증명이 없으면 값이 Funnel 내부 주소라 "나인지 아닌지" 를 비교할 수가 없다.
        // 모르는 채로 되돌리기 어려운 일을 하지 않는다.
        assertThat(IpBlockService.canBlockSafely(degraded("127.0.0.1"), "198.51.100.7")).isFalse();
    }

    /*
     * ---------------------------------------------------------------------
     * 거는 쪽 — 안전장치가 저장 '앞' 에 있는가.
     *
     * 아래 셋도 Redis 를 주지 않고 돈다. 거절된 요청이 저장소를 건드리면 여기서 터진다.
     * 부르는 쪽에 검사를 맡기면 다음 호출자가 하나를 빠뜨리고, 그 대가는 관리자가 자기
     * 도구에서 잠기는 것이다.
     * ---------------------------------------------------------------------
     */

    @Test
    @DisplayName("자기 자신은 저장까지 가지도 않고 거절된다")
    void blockRefusesSelfBeforeTouchingStore() {
        IpBlockService service = new IpBlockService(null);

        assertThat(
                        service.block(
                                        "203.0.113.42",
                                        Duration.ofHours(1),
                                        "사유",
                                        verified("203.0.113.42"),
                                        "admin")
                                .refusal())
                .isEqualTo(IpBlockService.Refusal.SELF_BLOCK);
    }

    @Test
    @DisplayName("요청자 위치가 증명 안 되면 저장까지 가지도 않고 거절된다")
    void blockRefusesUnprovenOriginBeforeTouchingStore() {
        IpBlockService service = new IpBlockService(null);

        assertThat(
                        service.block(
                                        "198.51.100.7",
                                        Duration.ofHours(1),
                                        "사유",
                                        degraded("127.0.0.1"),
                                        "admin")
                                .refusal())
                .isEqualTo(IpBlockService.Refusal.ORIGIN_UNPROVEN);
    }

    @Test
    @DisplayName("내부 주소는 저장까지 가지도 않고 거절된다")
    void blockRefusesInternalAddressBeforeTouchingStore() {
        IpBlockService service = new IpBlockService(null);

        assertThat(
                        service.block(
                                        "127.0.0.1",
                                        Duration.ofHours(1),
                                        "사유",
                                        verified("203.0.113.42"),
                                        "admin")
                                .refusal())
                .isEqualTo(IpBlockService.Refusal.NOT_BLOCKABLE);
    }

    /*
     * ---------------------------------------------------------------------
     * 임시인가.
     * ---------------------------------------------------------------------
     */

    @Test
    @DisplayName("차단 기간에 상한이 있다 — '임시' 가 실수로 영구가 되면 안 된다")
    void clampsDuration() {
        assertThat(IpBlockService.clampTtl(Duration.ofDays(100)))
                .isEqualTo(IpBlockService.MAX_BLOCK);
        assertThat(IpBlockService.clampTtl(Duration.ofHours(2))).isEqualTo(Duration.ofHours(2));
    }

    @Test
    @DisplayName("0 이나 음수를 넣어도 영구가 되지 않는다 — TTL 0 은 Redis 에서 '만료 없음' 이다")
    void clampsNonPositiveDuration() {
        assertThat(IpBlockService.clampTtl(Duration.ZERO)).isEqualTo(IpBlockService.MIN_BLOCK);
        assertThat(IpBlockService.clampTtl(Duration.ofMinutes(-5)))
                .isEqualTo(IpBlockService.MIN_BLOCK);
        assertThat(IpBlockService.clampTtl(null)).isEqualTo(IpBlockService.MIN_BLOCK);
    }
}
