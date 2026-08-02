package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

/**
 * 관리자 행위 감사 로그 — 누가 · 무엇을 · 어디에 · 성공했는가.
 *
 * <p><b>최소 정보 원칙.</b> 이 표는 개인정보 저장소가 되면 안 된다. 감사 로그는 이 서비스에서 보존 기간이 가장 길어서, 여기 들어간 개인정보가 가장 오래 남는다.
 * 요청 본문 · 토큰 · IP · 이메일 · 닉네임 · User-Agent · 쿼리스트링 전문을 저장하지 않는다.
 *
 * <p><b>대상은 내부 식별자로만 가리킨다.</b> 회원을 가리켜야 하면 이메일이 아니라 {@code USERS.USER_ID}(UUID)다. 이메일은 그 자체로
 * 개인정보이고, 계정이 바뀌면 추적도 끊긴다. 내부 id 는 둘 다 해결한다.
 *
 * <p>{@code action} 은 실제 URI 가 아니라 <b>매핑 패턴</b>이다. URI 를 그대로 넣으면 경로에 박힌 id 가 action 문자열로 새어 "이 동작이
 * 몇 번 일어났나" 같은 집계가 불가능해진다.
 *
 * <p>수정자({@code @Setter})가 없다. 쓰고 나서 고칠 수 있는 감사 로그는 감사 로그가 아니다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "admin_audit_log",
        indexes = {
            // V29 SQL 에도 같은 이름으로 있다. 양쪽에 두는 이유는 환경마다 스키마를 만드는 주체가
            // 다르기 때문이다 — dev/test 는 Hibernate ddl-auto, prod 는 Flyway. 한쪽에만 쓰면
            // 다른 쪽에는 인덱스가 아예 생기지 않는다.
            @Index(name = "idx_admin_audit_created", columnList = "created_at"),
            @Index(name = "idx_admin_audit_actor", columnList = "actor_id, created_at"),
            @Index(
                    name = "idx_admin_audit_target",
                    columnList = "target_type, target_id, created_at")
        })
public class AdminAuditLog {

    /** 팝업 — 승인 · 거절 · 상태변경 · 영구삭제. */
    public static final String TARGET_POPUP = "POPUP";

    /** 라이브 댓글 — 단건/일괄 삭제. */
    public static final String TARGET_CHAT = "CHAT";

    /** 동행 게시글 — 강제 삭제. */
    public static final String TARGET_MATE_POST = "MATE_POST";

    /** 의견 — 답변 등록 · 삭제. */
    public static final String TARGET_FEEDBACK = "FEEDBACK";

    /** 관리자 본인 계정 — 2단계 인증 등록/해제, 전체 세션 무효화, 관리자 로그인. */
    public static final String TARGET_ADMIN_SELF = "ADMIN_SELF";

    /** 회원 개인정보 대량 열람 — 회원 목록 · 방문자 목록. 무엇을 봤는지가 아니라 '봤다'는 사실만 남긴다. */
    public static final String TARGET_MEMBER_DATA = "MEMBER_DATA";

    /** 서버 로그 스트림 열람. 로그 원문에 무엇이 섞여 나갈지 통제할 수 없어 열람 자체가 기록 대상이다. */
    public static final String TARGET_SERVER_LOG = "SERVER_LOG";

    /** 전역 배치 — 크롤 실행 · 백필 · 중복정리 · 색인 재구성 등. 개별 대상 id 가 없다. */
    public static final String TARGET_SYSTEM = "SYSTEM";

    /**
     * 스케줄러가 남긴 기록의 행위자.
     *
     * <p>UUID 형식이 아니므로 사람 계정과 절대 충돌하지 않는다. 사람이 부르는 것과 <b>같은 메서드</b>를 스케줄러도 부르기 때문에 필요하다 — 이것이 없으면
     * 감사 로그에 없는 삭제를 "일어나지 않았다" 로 잘못 읽는다.
     */
    public static final String ACTOR_SYSTEM = "SYSTEM";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 행위자 — {@code USERS.USER_ID}(UUID) 또는 {@link #ACTOR_SYSTEM}. 이메일이 아니다. */
    @Column(name = "actor_id", nullable = false, length = 64)
    private String actorId;

    /** {@code "POST /api/admin/popups/{id}/approve"} — HTTP 메서드 + 매핑 패턴. */
    @Column(name = "action", nullable = false, length = 120)
    private String action;

    /** {@code TARGET_*} 상수 중 하나. */
    @Column(name = "target_type", nullable = false, length = 30)
    private String targetType;

    /** 내부 식별자(숫자 또는 UUID). 배치성 작업은 대상이 없어 null 이다. */
    @Column(name = "target_id", length = 64)
    private String targetId;

    @Column(name = "success", nullable = false)
    private boolean success;

    /** HTTP 상태코드. 403/404/500 구분이 사후 조사의 첫 질문이라 남긴다. */
    @Column(name = "status_code")
    private Short statusCode;

    /** 허용 목록 파라미터와 일괄 처리 건수만. 자유 문자열이 아니다. */
    @Column(name = "detail", length = 200)
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
