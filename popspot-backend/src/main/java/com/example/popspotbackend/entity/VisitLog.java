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
 * <p>게스트/회원 방문 집계 전용. IP·개인정보는 저장하지 않으며, {@code visitorId} 는 클라이언트가 만든 익명 UUID(개인 식별 불가)다. {@code
 * userAgent} 는 봇 식별/제외 목적으로만 저장하는 브라우저·기기 종류 문자열(개인 식별 불가)이다. {@code referrerHost} 는 유입 출처의 도메인
 * 또는 분류값만 남긴다(전체 URL 미저장 — 개인 식별 불가).
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

    /**
     * 유입 출처 — 도메인(예: {@code search.naver.com}) 또는 분류값(direct=주소 직접 입력·북마크, internal=사이트 내 이동).
     * 전체 URL 은 쿼리스트링에 검색어·개인정보가 실릴 수 있어 저장하지 않는다. 이 기능 배포 이전 방문은 출처를 알 수 없어 NULL 이다.
     */
    @Column(name = "referrer_host", length = 255)
    private String referrerHost;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
