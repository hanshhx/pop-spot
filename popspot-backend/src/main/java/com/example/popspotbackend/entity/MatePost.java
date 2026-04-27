package com.example.popspotbackend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "MATE_POST")
public class MatePost {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "mate_post_seq_gen")
    @SequenceGenerator(name = "mate_post_seq_gen", sequenceName = "mate_post_seq", allocationSize = 1)
    @Column(name = "POST_ID")
    private Long id;

    private String title;
    private String content;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "USER_ID")
    private User author;

    private String status; // RECRUITING, CLOSED

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

    // 🔥 [추가 1] 채팅방에 들어온 유저들의 ID를 콤마(,)로 연결해서 저장하는 명단
    @Column(name = "JOINED_USERS", length = 2000)
    @Builder.Default
    private String joinedUsers = "";

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = "RECRUITING";
        if (this.currentPeople == 0) this.currentPeople = 1;
        // 작성자는 기본적으로 명단에 추가
        if (this.joinedUsers == null) this.joinedUsers = "";
        if (this.author != null && !this.joinedUsers.contains(this.author.getUserId())) {
            this.joinedUsers += this.author.getUserId() + ",";
        }
    }

    public void increaseCurrentPeople() {
        if (this.currentPeople < this.maxPeople) {
            this.currentPeople++;
        }
    }

    // 🔥 [추가 2] 명단에 유저 추가하는 기능
    public void addJoinedUser(String userId) {
        if (this.joinedUsers == null) this.joinedUsers = "";
        if (!this.joinedUsers.contains(userId)) {
            this.joinedUsers += userId + ",";
        }
    }

    // 🔥 [추가 3] 명단에 있는 사람인지 확인하는 기능
    public boolean hasJoined(String userId) {
        if (this.author != null && this.author.getUserId().equals(userId)) return true; // 방장은 프리패스
        return this.joinedUsers != null && this.joinedUsers.contains(userId);
    }
}