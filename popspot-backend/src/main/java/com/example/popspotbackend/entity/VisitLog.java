package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

/**
 * 익명 방문 로그.
 *
 * <p>게스트/회원 방문 집계 전용. IP·개인정보는 저장하지 않으며, {@code visitorId} 는 클라이언트가 만든 익명 UUID(개인 식별 불가)다.
 * {@code userAgent} 는 봇 식별/제외 목적으로만 저장하는 브라우저·기기 종류 문자열(개인 식별 불가)이다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "visit_log")
public class VisitLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "visitor_id", nullable = false, length = 64)
    private String visitorId;

    @Column(length = 255)
    private String path;

    @Column(nullable = false)
    private boolean guest;

    /** 봇 식별/제외용 User-Agent(브라우저·기기 종류). 개인 식별 불가. */
    @Column(name = "user_agent", length = 400)
    private String userAgent;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
