package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 사용자가 운영팀에 보낸 의견 한 건.
 *
 * <p>{@code userId} 는 비로그인 사용자가 보낼 때 NULL 이며, 이 경우 답신을 받고 싶으면
 * {@code guestEmail} 을 채워 보낸다. 상태는 어드민이 직접 갱신한다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "FEEDBACK")
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "feedback_generator")
    @SequenceGenerator(name = "feedback_generator", sequenceName = "feedback_seq", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    /** 로그인 사용자의 userId. 비로그인 의견이면 NULL. */
    @Column(name = "USER_ID")
    private String userId;

    /** 비로그인 사용자의 답신용 이메일. 선택 입력. */
    @Column(name = "GUEST_EMAIL")
    private String guestEmail;

    /** BUG / FEATURE / GOOD / OTHER. enum 대신 String — DB 마이그레이션 자유로움. */
    @Column(name = "CATEGORY", nullable = false)
    private String category;

    @Column(name = "TITLE", nullable = false)
    private String title;

    @Column(name = "CONTENT", columnDefinition = "TEXT", nullable = false)
    private String content;

    /** PENDING / REVIEWING / RESOLVED / WONT_FIX. */
    @Column(name = "STATUS", nullable = false)
    private String status;

    @Column(name = "ADMIN_REPLY", columnDefinition = "TEXT")
    private String adminReply;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    @Column(name = "REPLIED_AT")
    private LocalDateTime repliedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = "PENDING";
        }
    }
}
