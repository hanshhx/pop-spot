package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
 * 메이트(동행) 게시글의 1:1/그룹 채팅 메시지.
 *
 * <p>{@link ChatMessage} 와 동일한 이유로 SEQUENCE 전략을 쓴다 — 채팅 메시지 저장 시 ID 가 NULL 로 들어가던 사고가 SEQUENCE 로
 * 우회된 적이 있어 그대로 유지.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "MATE_CHAT_MESSAGE")
public class MateChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "chat_msg_seq_gen")
    @SequenceGenerator(name = "chat_msg_seq_gen", sequenceName = "chat_msg_seq", allocationSize = 1)
    @Column(name = "MESSAGE_ID")
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "POST_ID")
    private MatePost matePost;

    private String sender;

    @Column(length = 1000)
    private String message;

    @Column(length = 20)
    @Builder.Default
    private String type = "TALK";

    @Column(name = "FILE_URL", length = 2048)
    private String fileUrl;

    private LocalDateTime sendTime;

    @PrePersist
    public void prePersist() {
        if (this.sendTime == null) {
            this.sendTime = LocalDateTime.now();
        }
    }
}
