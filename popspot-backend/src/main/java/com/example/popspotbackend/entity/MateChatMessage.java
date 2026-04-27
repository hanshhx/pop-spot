package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter // Lombok이 작동하지 않을 경우를 대비해 아래에 직접 추가합니다.
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "MATE_CHAT_MESSAGE")
public class MateChatMessage {

    @Id
    // 🔥 [수정] Oracle Sequence 제거 -> MySQL Identity 사용
    // 🚨 [임의 수정 - PostgreSQL 대응]
    // 채팅 전송 시 발생하는 null identifier 에러를 해결하기 위해,
    // PostgreSQL이 정상적으로 ID를 생성할 수 있도록 SEQUENCE 전략으로 변경했습니다.
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

    private LocalDateTime sendTime;

    // 🔥 [수정] 에러 해결을 위한 직접 Setter 추가
    public void setMatePost(MatePost matePost) {
        this.matePost = matePost;
    }

    public void setSendTime(LocalDateTime sendTime) {
        this.sendTime = sendTime;
    }

    @PrePersist
    public void prePersist() {
        if (this.sendTime == null) {
            this.sendTime = LocalDateTime.now();
        }
    }
}