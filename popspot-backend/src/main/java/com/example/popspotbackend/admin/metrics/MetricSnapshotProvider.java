package com.example.popspotbackend.admin.metrics;

import java.util.Map;

/**
 * 어드민 대시보드에 노출할 메트릭 한 묶음을 제공하는 인터페이스.
 *
 * <p>새 메트릭 카드를 추가하려면 이 인터페이스를 구현한 Spring 빈을 하나 더 만들면 된다.
 *
 * <p>{@link AdminMetricsController#getDashboard()} 가 List 로 자동 주입받아 합성한다.
 */
public interface MetricSnapshotProvider {

    /** 응답 JSON 의 최상위 키 (예: "jvm", "http", "db", "crawler"). 소문자 영문 단어 권장. */
    String key();

    /** 메트릭 한 묶음. 직렬화 시 안전한 타입 (Number / String / Boolean / 그 컬렉션) 만. */
    Map<String, Object> snapshot();
}
