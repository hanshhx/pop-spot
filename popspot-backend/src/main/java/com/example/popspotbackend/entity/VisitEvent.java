package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

/**
 * 방문 안에서 <b>무엇을 했는지</b>.
 *
 * <p>{@link VisitLog} 는 "어떤 페이지를 열었다" 만 담아서, "어떤 팝업이 실제로 눌렸나" 같은 질문에 답하지 못한다. 목록을 훑기만 한 것과 카드를 누른
 * 것이 구분되지 않기 때문이다.
 *
 * <p><b>회원 계정과 연결하지 않는다.</b> {@link VisitLog} 와 마찬가지로 게스트 여부만 두고 회원 식별자는 저장하지 않는다. 세션으로 행동을 묶는
 * 것만으로도 식별 가능성이 올라가는데, 거기에 계정까지 이으면 "누가 무엇을 봤는지" 의 완전한 기록이 된다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "visit_event",
        indexes = {
            // V32 SQL 에도 같은 이름으로 있다. 환경마다 스키마를 만드는 주체가 다르기 때문이다 —
            // dev/test 는 Hibernate, prod 는 Flyway. 한쪽에만 쓰면 다른 쪽에 인덱스가 안 생긴다.
            @Index(name = "idx_visit_event_created", columnList = "created_at"),
            @Index(name = "idx_visit_event_popup", columnList = "popup_id, created_at"),
            @Index(name = "idx_visit_event_type", columnList = "event_type, created_at")
        })
public class VisitEvent {

    /** 팝업 카드를 눌러 상세를 열었다. */
    public static final String TYPE_POPUP_OPEN = "popup_open";

    /** 지도에서 검색했다. */
    public static final String TYPE_MAP_SEARCH = "map_search";

    /** 팝업을 공유했다. */
    public static final String TYPE_POPUP_SHARE = "popup_share";

    /**
     * 받아들이는 행동 종류.
     *
     * <p>목록에 없는 값은 <b>저장하지 않는다.</b> 자유 문자열로 두면 오타가 새 종류로 쌓여 집계가 갈라지고, 클라이언트가 보낸 아무 값이나 DB 에 들어간다.
     * 종류를 늘릴 때는 여기에 먼저 추가한다 — 그때 개인정보 처리방침의 "정해진 목록" 서술도 함께 본다.
     */
    public static final Set<String> ALLOWED_TYPES =
            Set.of(TYPE_POPUP_OPEN, TYPE_MAP_SEARCH, TYPE_POPUP_SHARE);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 브라우저가 만든 익명 값. {@link VisitLog} 와 같은 값이라 두 표를 이어 볼 수 있다. */
    @Column(name = "visitor_id", nullable = false, length = 64)
    private String visitorId;

    /** 한 번의 방문을 묶는 값. 30분간 활동이 없으면 브라우저가 새로 만든다. */
    @Column(name = "session_id", length = 64)
    private String sessionId;

    /** {@link #ALLOWED_TYPES} 중 하나. */
    @Column(name = "event_type", nullable = false, length = 30)
    private String eventType;

    /** 대상 팝업. 대상이 없는 행동은 비어 있다. */
    @Column(name = "popup_id")
    private Long popupId;

    /** 그 행동이 일어난 화면. 노출 대비 클릭을 보려면 어느 목록에서 눌렸는지가 필요하다. */
    @Column(name = "path", length = 255)
    private String path;

    /** 회원/게스트 구분만. 회원 식별자는 저장하지 않는다. */
    @Column(name = "guest", nullable = false)
    private boolean guest;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
