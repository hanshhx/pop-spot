package com.example.popspotbackend.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/**
 * 예약 작업이 <b>꺼져 있다</b>는 사실을 로그에 남긴다.
 *
 * <p>없어도 동작에는 지장이 없다. 그런데 없으면 로그에 아무 말도 남지 않아서, 나중에 "왜 크롤이 안 돌지" 를 조사할 때 <b>고장</b>과 <b>일부러 꺼둔
 * 것</b>을 구별할 수 없다. 이번 이전에서는 몇 주 동안 꺼진 채로 운영하므로 그 구별이 실제로 필요하다.
 *
 * <p>{@code havingValue = "false"} 에 {@code matchIfMissing = true} 를 둔 이유는, 설정을 <b>아예 안 넣은 경우</b>도
 * 꺼진 상태이기 때문이다. 그때가 오히려 더 조용해서 알려 줄 값이 크다.
 */
@Slf4j
@Configuration
@ConditionalOnProperty(
        name = "popspot.scheduling.enabled",
        havingValue = "false",
        matchIfMissing = true)
public class SchedulingDisabledNotice {

    @PostConstruct
    void announce() {
        log.warn(
                "[Scheduling] DISABLED — 모든 Spring 예약 작업이 중단됨"
                        + " (크롤·만료처리·중복정리·번역백필·백업·감사로그정리·위시만료·SLA알림)."
                        + " 켜려면 POPSPOT_SCHEDULING_ENABLED=true");
    }
}
