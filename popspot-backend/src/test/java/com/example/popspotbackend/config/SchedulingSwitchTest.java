package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 예약 작업 전체 스위치가 <b>기본으로 꺼져 있는지</b> 지킨다.
 *
 * <p><b>왜 이게 중요한가.</b> 새 서버 이전에는 DB 가 아직 진짜가 아닌 구간이 있다 — 빈 DB 로 헬스체크를 하거나, 스냅샷을 시드한 임시 공개 DB 로 읽기
 * 전용 운영을 하는 때다. 그 사이에 예약 작업이 돌면 만료 처리와 중복 정리가 임시 DB 를 고치고, 백업 스케줄러가 빈 DB 를 떠서 7일 보관 목록에 섞어 놓는다.
 *
 * <p>예약 작업이 붙은 클래스는 아홉 개인데 개별 스위치가 있는 것은 크롤러 하나뿐이었다. 나머지는 애플리케이션이 뜨는 순간 함께 시작한다.
 *
 * <p><b>스프링 컨텍스트를 띄우지 않고 검사하는 이유.</b> 이 PC 는 로컬 소켓 쌍이 막혀 있어 컨텍스트를 올리는 테스트가 아예 못 돈다. 그리고 여기서 지켜야 할
 * 것은 런타임 동작이 아니라 <b>선언</b>이다 — 기본값이 꺼짐인가, 메인 클래스에 스케줄링이 다시 붙지 않았는가.
 */
class SchedulingSwitchTest {

    @Test
    @DisplayName("설정이 없으면 꺼진 쪽이다 — 빠뜨렸을 때 켜지면 안 된다")
    void missingPropertyMeansDisabled() {
        ConditionalOnProperty on =
                SchedulingConfig.class.getAnnotation(ConditionalOnProperty.class);

        assertThat(on).describedAs("스위치 조건이 아예 없다 — 항상 켜진다").isNotNull();
        assertThat(on.name()).containsExactly("popspot.scheduling.enabled");
        assertThat(on.havingValue()).isEqualTo("true");
        assertThat(on.matchIfMissing()).describedAs("설정을 빠뜨렸을 때 켜지면 이 스위치의 목적이 사라진다").isFalse();
    }

    @Test
    @DisplayName("false 면 스케줄링을 켜는 설정이 만들어지지 않는다")
    void falseKeepsSchedulingOff() {
        // @EnableScheduling 은 이 클래스에만 있고, 이 클래스는 조건이 맞을 때만 만들어진다.
        assertThat(SchedulingConfig.class.getAnnotation(EnableScheduling.class))
                .describedAs("@EnableScheduling 이 조건부 클래스에 있어야 한다")
                .isNotNull();

        ConditionalOnProperty on =
                SchedulingConfig.class.getAnnotation(ConditionalOnProperty.class);
        assertThat("false".equals(on.havingValue()))
                .describedAs("havingValue 가 true 여야 false 일 때 꺼진다")
                .isFalse();
    }

    /**
     * 메인 클래스에 {@code @EnableScheduling} 이 남아 있으면 스위치가 <b>무력화된다.</b> 조건부 클래스를 아무리 잘 만들어도 메인에서 이미 켜
     * 버리기 때문이다. 옮겨 놓고 지우지 않는 실수가 흔해서 못 박는다.
     */
    @Test
    @DisplayName("메인 클래스에는 스케줄링이 붙어 있지 않다 — 남아 있으면 스위치가 무의미하다")
    void mainClassDoesNotEnableScheduling() {
        assertThat(
                        com.example.popspotbackend.PopspotBackendApplication.class.getAnnotation(
                                EnableScheduling.class))
                .describedAs("메인 클래스가 스케줄링을 켜 버리면 popspot.scheduling.enabled 가 아무 일도 못 한다")
                .isNull();
    }

    /**
     * 꺼져 있을 때도 로그가 남아야 한다.
     *
     * <p>없어도 동작에는 지장이 없다. 그런데 없으면 몇 주 뒤에 "왜 크롤이 안 돌지" 를 조사할 때 <b>고장</b>과 <b>일부러 꺼둔 것</b>을 구별할 수 없다.
     * 이번 이전에서는 꺼진 채로 오래 운영하므로 그 구별이 실제로 필요하다.
     */
    @Test
    @DisplayName("꺼진 상태를 알리는 쪽도 있다 — 조용히 꺼져 있으면 고장과 구별이 안 된다")
    void disabledStateIsAnnounced() {
        ConditionalOnProperty off =
                SchedulingDisabledNotice.class.getAnnotation(ConditionalOnProperty.class);

        assertThat(off).isNotNull();
        assertThat(off.havingValue()).isEqualTo("false");
        assertThat(off.matchIfMissing())
                .describedAs("설정을 안 넣은 경우가 오히려 더 조용하다 — 그때도 알려야 한다")
                .isTrue();
    }
}
