package com.example.popspotbackend.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Spring 예약 작업 전체를 켜고 끄는 스위치. <b>기본값은 꺼짐이다.</b>
 *
 * <p><b>왜 필요한가.</b> 2026-08-13 에 집 VM 이 죽어 백엔드를 새 서버로 옮기게 됐다. 그 과정에는 <b>DB 가 아직 진짜가 아닌 구간</b>이 있다 —
 * 빈 DB 로 헬스체크를 하거나, 스냅샷을 시드한 임시 공개 DB 로 읽기 전용 운영을 하는 때다.
 *
 * <p>그런데 예약 작업 아홉 개 중 개별 스위치가 있는 것은 크롤러 하나뿐이었다. 나머지는 <b>애플리케이션이 뜨는 순간 함께 시작한다.</b> 헬스체크 한 번 하려고
 * 띄웠는데 만료 처리와 중복 정리가 임시 DB 를 고치고, 백업 스케줄러가 빈 DB 를 떠서 7일 보관 목록에 섞어 놓는다.
 *
 * <p>그래서 개별 스위치를 아홉 개 만들지 않고 <b>한 곳에서 전부 끈다.</b> 이번 목적이 "전부 끄기" 라 세밀할 필요가 없고, 하나라도 빠뜨리면 그것이 곧 사고이기
 * 때문이다.
 *
 * <p><b>이것이 막지 <em>않는</em> 것.</b> 시간에 따라 도는 작업만 막는다. 아래는 별도로 막아야 한다.
 *
 * <ul>
 *   <li>관리자 수동 크롤·백필 실행
 *   <li>팝업 수정·삭제 API
 *   <li>회원가입 · 찜 · 채팅 · 결제
 *   <li>파일 업로드
 * </ul>
 *
 * <p>즉 비상 운영 구간에서는 이 스위치와 함께 <b>서버 또는 Cloudflare 의 공개 {@code GET} 허용목록</b>이 여전히 필요하다.
 *
 * <p><b>켜는 시점.</b> 새 서버 이전 계획(<i>docs/plan-2026-08-oracle-migration.md</i>) 14단계다. 쓰기 기능을 연 뒤 크롤러를
 * 수동으로 한 번 돌려 결과를 검수하고 백업을 확인한 다음에 켠다. 바로 {@code true} 로 두지 않는다.
 *
 * <pre>
 * POPSPOT_SCHEDULING_ENABLED=true
 * </pre>
 */
@Slf4j
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "popspot.scheduling.enabled", havingValue = "true")
public class SchedulingConfig {

    /**
     * 켜졌다는 사실을 로그에 남긴다.
     *
     * <p>꺼진 경우에는 이 클래스 자체가 만들어지지 않아 여기서 찍을 수 없다. 그쪽은 {@link SchedulingDisabledNotice} 가 맡는다. 둘을 나눈
     * 이유는 "설정을 안 넣어서 꺼진 것" 과 "일부러 켠 것" 이 로그만 보고 구별돼야 하기 때문이다.
     */
    @PostConstruct
    void announce() {
        log.info("[Scheduling] ENABLED — Spring 예약 작업이 동작합니다");
    }
}
