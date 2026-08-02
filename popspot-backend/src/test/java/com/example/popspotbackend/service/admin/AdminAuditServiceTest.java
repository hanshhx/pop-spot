package com.example.popspotbackend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.AdminAuditLog;
import com.example.popspotbackend.repository.AdminAuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * 감사 로그가 <b>스스로 사고를 만들지 않는지</b> 확인한다.
 *
 * <p>감사 로그는 사고를 조사하기 위한 장치인데, 잘못 만들면 그 자체가 사고가 된다 — 개인정보를 쌓거나, 공격자가 자기 흔적을 지우거나, 감사 표를 채우는 것만으로
 * 서비스를 흔들 수 있다. 여기서 보는 것은 정상 기록보다 그 세 가지다.
 */
class AdminAuditServiceTest {

    private static final String ADMIN = "3f1a2b4c-5d6e-7f80-91a2-b3c4d5e6f708";

    private AdminAuditLogRepository repository;
    private AdminAuditService service;

    @BeforeEach
    void setUp() {
        repository = mock(AdminAuditLogRepository.class);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new AdminAuditService(repository);
    }

    private AdminAuditLog saved() {
        ArgumentCaptor<AdminAuditLog> captor = ArgumentCaptor.forClass(AdminAuditLog.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("대상 식별자가 숫자나 UUID 가 아니면 저장하지 않는다 — 이메일이 감사 표에 박히면 안 된다")
    void rejectsNonIdentifierTarget() {
        service.record(
                ADMIN,
                "GET /api/admin/users/{id}",
                "MEMBER_DATA",
                "someone@example.com",
                true,
                200,
                null);

        assertThat(saved().getTargetId()).describedAs("경로 변수는 결국 사용자가 보낸 문자열이다").isNull();
    }

    @Test
    @DisplayName("숫자 id 와 UUID 는 그대로 저장된다")
    void keepsRealIdentifiers() {
        service.record(
                ADMIN, "POST /api/admin/popups/{id}/approve", "POPUP", "12345", true, 200, null);
        assertThat(saved().getTargetId()).isEqualTo("12345");

        AdminAuditLogRepository repo2 = mock(AdminAuditLogRepository.class);
        AdminAuditService svc2 = new AdminAuditService(repo2);
        svc2.record(ADMIN, "GET /api/admin/users", "MEMBER_DATA", ADMIN, true, 200, null);

        ArgumentCaptor<AdminAuditLog> captor = ArgumentCaptor.forClass(AdminAuditLog.class);
        verify(repo2).save(captor.capture());
        assertThat(captor.getValue().getTargetId()).isEqualTo(ADMIN);
    }

    @Test
    @DisplayName("긴 detail 을 잘라도 문자가 반으로 쪼개지지 않는다 — 이모지 하나로 기록을 실패시킬 수 있으면 안 된다")
    void clampDoesNotSplitCharacters() {
        // 199자 뒤에 두 칸짜리 문자(이모지) 하나 → 200번째에서 그냥 자르면 짝 없는 조각이 남는다.
        String detail = "a".repeat(199) + "😀";

        service.record(ADMIN, "POST /api/admin/popups/dedupe", "SYSTEM", null, true, 200, detail);

        String stored = saved().getDetail();
        assertThat(stored).hasSizeLessThanOrEqualTo(200);
        assertThat(Character.isHighSurrogate(stored.charAt(stored.length() - 1)))
                .describedAs("마지막 글자가 짝 없는 조각이면 PostgreSQL 이 문자열을 거부한다")
                .isFalse();
    }

    @Test
    @DisplayName("기록이 실패해도 예외가 밖으로 나가지 않는다 — 감사 로그가 관리자 작업을 망치면 안 된다")
    void recordFailureDoesNotPropagate() {
        when(repository.save(any())).thenThrow(new IllegalStateException("DB 없음"));

        service.record(ADMIN, "POST /api/admin/popups/dedupe", "SYSTEM", null, true, 200, null);
        // 예외가 나갔다면 이 줄에 도달하지 못한다.
    }

    @Test
    @DisplayName("권한 거부는 계정당 1분에 한 줄로 접힌다 — 일반 회원 하나가 감사 표를 무한히 채우지 못한다")
    void accessDeniedIsThrottledPerActor() {
        for (int i = 0; i < 50; i++) {
            service.recordAccessDenied("attacker-id", "GET /api/admin/users");
        }

        verify(repository, times(1)).save(any());
    }

    @Test
    @DisplayName("억제된 시도 횟수는 잃지 않는다 — 다음 기록에 합산된다")
    void suppressedAttemptsAreCounted() {
        // 첫 줄이 기록되고 나머지는 억제된다. 억제분은 카운터에 쌓인다.
        for (int i = 0; i < 5; i++) {
            service.recordAccessDenied("attacker-id", "GET /api/admin/users");
        }

        assertThat(saved().getDetail()).describedAs("첫 기록에는 아직 합산할 억제분이 없다").isEqualTo("권한없음");
    }

    @Test
    @DisplayName("서로 다른 계정은 서로의 억제에 영향받지 않는다")
    void throttleIsPerActor() {
        service.recordAccessDenied("user-a", "GET /api/admin/users");
        service.recordAccessDenied("user-b", "GET /api/admin/users");

        verify(repository, times(2)).save(any());
    }

    @Test
    @DisplayName("권한 거부는 실패로, 403 으로 기록된다")
    void accessDeniedIsRecordedAsFailure() {
        service.recordAccessDenied("user-a", "DELETE /api/admin/popups/1");

        AdminAuditLog log = saved();
        assertThat(log.isSuccess()).isFalse();
        assertThat(log.getStatusCode()).isEqualTo((short) 403);
        assertThat(log.getActorId()).isEqualTo("user-a");
    }
}
