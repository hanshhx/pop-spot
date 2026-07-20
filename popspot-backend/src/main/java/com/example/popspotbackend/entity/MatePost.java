package com.example.popspotbackend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 동행 모집 게시글.
 *
 * <p>참가자 명단은 join 테이블 대신 콤마 구분 문자열 {@code joinedUsers} 로 단순 저장한다. 작성자는 기본적으로 명단에 포함되며 별도 정원 검사 없이
 * 재입장이 가능하다. 게시글 삭제 시 채팅 메시지도 cascade 로 함께 제거된다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "MATE_POST")
public class MatePost {

    private static final String STATUS_RECRUITING = "RECRUITING";
    private static final String USER_DELIMITER = ",";

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "mate_post_seq_gen")
    @SequenceGenerator(
            name = "mate_post_seq_gen",
            sequenceName = "mate_post_seq",
            allocationSize = 1)
    @Column(name = "POST_ID")
    private Long id;

    private String title;
    private String content;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "USER_ID")
    private User author;

    /** RECRUITING / CLOSED. */
    private String status;

    private int maxPeople;

    @Column(columnDefinition = "integer default 1")
    private int currentPeople;

    private String targetPopup;
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "matePost", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<MateChatMessage> chatMessages;

    @Column(name = "IS_MEGAPHONE", nullable = false)
    @Builder.Default
    private boolean isMegaphone = false;

    /** v2.18.1 — 누적 신고 수. 임계값 도달 시 isHidden 자동 true. */
    @Column(name = "REPORT_COUNT", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private int reportCount = 0;

    /** v2.18.1 — 신고 누적으로 자동 차단된 글. 목록 조회에서 제외. */
    @Column(name = "IS_HIDDEN", nullable = false)
    @Builder.Default
    private boolean isHidden = false;

    /** 콤마 구분 참가자 ID 명단 (조회 단순화를 위해 정규화하지 않는다). */
    @Column(name = "JOINED_USERS", length = 2000)
    @Builder.Default
    private String joinedUsers = "";

    /** v2.22 — 콤마 구분 신고자 ID 명단. 1인 1신고 보장(같은 유저의 반복 신고로 인한 자동숨김 어뷰징 차단). */
    @Column(name = "REPORTED_BY", length = 2000)
    @Builder.Default
    private String reportedBy = "";

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = STATUS_RECRUITING;
        if (this.currentPeople == 0) this.currentPeople = 1;
        if (this.joinedUsers == null) this.joinedUsers = "";
        if (this.author != null && !this.joinedUsers.contains(this.author.getUserId())) {
            this.joinedUsers += this.author.getUserId() + USER_DELIMITER;
        }
    }

    public void increaseCurrentPeople() {
        if (this.currentPeople < this.maxPeople) {
            this.currentPeople++;
        }
    }

    public void addJoinedUser(String userId) {
        if (this.joinedUsers == null) this.joinedUsers = "";
        if (!this.joinedUsers.contains(userId)) {
            this.joinedUsers += userId + USER_DELIMITER;
        }
    }

    /** 방장은 항상 통과. 그 외에는 명단 문자열에 userId 가 포함됐는지로 판정. */
    public boolean hasJoined(String userId) {
        if (this.author != null && this.author.getUserId().equals(userId)) return true;
        return this.joinedUsers != null && this.joinedUsers.contains(userId);
    }

    /**
     * 이미 신고한 사용자인지 — 콤마 구분 명단에서 토큰 단위 정확 일치로 판정.
     *
     * <p>{@code contains} 가 아니라 split+equals 로 비교해, 한 ID 가 다른 ID 의 부분 문자열일 때 발생하는 오탐을 막는다.
     */
    public boolean hasReported(String userId) {
        if (userId == null || this.reportedBy == null || this.reportedBy.isEmpty()) return false;
        for (String token : this.reportedBy.split(USER_DELIMITER)) {
            if (token.equals(userId)) return true;
        }
        return false;
    }

    /** 신고자 명단에 추가(이미 있으면 무시). */
    public void addReporter(String userId) {
        if (userId == null) return;
        if (this.reportedBy == null) this.reportedBy = "";
        if (!hasReported(userId)) {
            this.reportedBy += userId + USER_DELIMITER;
        }
    }
}
