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
 * 팝업별 "지금 어때요?" 원터치 대기 제보.
 *
 * <p>실시간 채팅은 동시 접속자가 있어야 돌지만, 이 제보는 혼자 눌러도 다음 사람에게 가치가 남는 <b>비동기 신호</b>다. 글쓰기 없이 버튼 한 번이라 참여 문턱이 매우
 * 낮다.
 *
 * <p>{@code waitLevel} 0 = 바로 입장, 1 = 조금 대기, 2 = 많이 대기.
 *
 * <p>{@code reporterKey} 는 로그인 유저면 {@code u:userId}, 게스트면 {@code g:익명visitorId}(개인 식별 불가). 중복 제보
 * 제한(쿨다운)에만 쓴다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "popup_wait_report",
        indexes = {
            @Index(name = "idx_wait_popup_created", columnList = "popup_id, created_at"),
            @Index(name = "idx_wait_reporter", columnList = "popup_id, reporter_key, created_at")
        })
public class PopupWaitReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "popup_id", nullable = false)
    private Long popupId;

    /** 0 = 바로 입장, 1 = 조금 대기, 2 = 많이 대기. */
    @Column(name = "wait_level", nullable = false)
    private int waitLevel;

    @Column(name = "reporter_key", nullable = false, length = 64)
    private String reporterKey;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
