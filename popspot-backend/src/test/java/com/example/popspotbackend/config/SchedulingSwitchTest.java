package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

/**
 * 예약 작업 전체 스위치가 <b>실제로</b> 작업을 막는지 본다.
 *
 * <p><b>왜 이게 중요한가.</b> 새 서버 이전에는 DB 가 아직 진짜가 아닌 구간이 있다 — 빈 DB 로 헬스체크를 하거나, 스냅샷을 시드한 임시 공개 DB 로 읽기
 * 전용 운영을 하는 때다. 그 사이에 예약 작업이 돌면 만료 처리와 중복 정리가 임시 DB 를 고치고, 백업 스케줄러가 빈 DB 를 떠서 7일 보관 목록에 섞어 놓는다.
 *
 * <p>예약 작업이 붙은 클래스는 아홉 개인데 개별 스위치가 있는 것은 크롤러 하나뿐이었다. 나머지는 애플리케이션이 뜨는 순간 함께 시작한다.
 *
 * <p><b>어노테이션만 보던 것을 컨텍스트로 바꿨다.</b> 처음에는 {@code @ConditionalOnProperty} 의 값만 확인했는데, 그러면 "꺼지면 작업이
 * 0개" 라는 약속을 검사하지 못한다. {@link ApplicationContextRunner} 는 웹 서버를 띄우지 않아 이 PC(로컬 소켓 쌍이 막혀 있다)에서도 돈다.
 */
class SchedulingSwitchTest {

    /** 스케줄링이 켜졌을 때 실제로 등록되는지 보려고 두는 시험용 작업. 간격이 길어 테스트 중에 돌지 않는다. */
    @Configuration
    static class TestJob {
        @Scheduled(fixedDelay = 86_400_000L)
        void neverRunsDuringTest() {
            // 등록 여부만 본다.
        }
    }

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner()
                    .withUserConfiguration(
                            SchedulingConfig.class, SchedulingDisabledNotice.class, TestJob.class);

    /** 설정을 빠뜨렸을 때 켜지면 이 스위치의 목적이 사라진다. 실수는 "설정을 안 넣는" 쪽으로 일어나므로 그때 안전한 쪽에 있어야 한다. */
    @Test
    @DisplayName("설정이 없으면 예약 작업이 등록되지 않는다")
    void missingPropertyRegistersNoTasks() {
        runner.run(
                context ->
                        assertThat(context)
                                .describedAs("설정을 빠뜨렸는데 스케줄링이 살아 있다")
                                .doesNotHaveBean(ScheduledAnnotationBeanPostProcessor.class));
    }

    @Test
    @DisplayName("false 면 예약 작업이 0개다")
    void falseRegistersNoTasks() {
        runner.withPropertyValues("popspot.scheduling.enabled=false")
                .run(
                        context ->
                                assertThat(context)
                                        .doesNotHaveBean(
                                                ScheduledAnnotationBeanPostProcessor.class));
    }

    @Test
    @DisplayName("true 면 예약 작업이 등록된다 — 끄기만 되고 켜지지 않으면 그것도 고장이다")
    void trueRegistersTasks() {
        runner.withPropertyValues("popspot.scheduling.enabled=true")
                .run(
                        context -> {
                            assertThat(context)
                                    .hasSingleBean(ScheduledAnnotationBeanPostProcessor.class);
                            assertThat(
                                            context.getBean(
                                                            ScheduledAnnotationBeanPostProcessor
                                                                    .class)
                                                    .getScheduledTasks())
                                    .describedAs("스케줄링은 켜졌는데 작업이 하나도 안 잡혔다")
                                    .isNotEmpty();
                        });
    }

    /**
     * 메인 클래스에 {@code @EnableScheduling} 이 남아 있으면 스위치가 <b>무력화된다.</b> 조건부 설정을 아무리 잘 만들어도 메인에서 이미 켜
     * 버리기 때문이다. 옮겨 놓고 지우지 않는 실수가 흔해서 못 박는다.
     *
     * <p>이건 컨텍스트로는 못 잡는다 — 위 테스트들은 메인 클래스를 올리지 않기 때문이다.
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
    @DisplayName("꺼진 상태를 알리는 쪽도 만들어진다 — 조용히 꺼져 있으면 고장과 구별이 안 된다")
    void disabledStateIsAnnounced() {
        runner.run(context -> assertThat(context).hasSingleBean(SchedulingDisabledNotice.class));

        ConditionalOnProperty off =
                SchedulingDisabledNotice.class.getAnnotation(ConditionalOnProperty.class);
        assertThat(off.matchIfMissing())
                .describedAs("설정을 안 넣은 경우가 오히려 더 조용하다 — 그때도 알려야 한다")
                .isTrue();
    }
}
