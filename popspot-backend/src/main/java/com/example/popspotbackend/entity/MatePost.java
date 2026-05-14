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

    /** 콤마 구분 참가자 ID 명단 (조회 단순화를 위해 정규화하지 않는다). */
    @Column(name = "JOINED_USERS", length = 2000)
    @Builder.Default
    private String joinedUsers = "";

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
}
