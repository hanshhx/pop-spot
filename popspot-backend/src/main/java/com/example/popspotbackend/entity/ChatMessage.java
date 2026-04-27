package com.example.popspotbackend.entity;

import com.example.popspotbackend.entity.PopupStore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Getter @Setter
@NoArgsConstructor
public class ChatMessage {

    @Id
    // 🔥 [수정 핵심] Oracle DB 호환을 위해 IDENTITY -> SEQUENCE로 변경
    // 이렇게 하면 Hibernate가 DB 시퀀스에서 번호를 먼저 따온 뒤 저장하므로 NULL 에러가 사라집니다.
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "chat_msg_seq_gen")
    @SequenceGenerator(name = "chat_msg_seq_gen", sequenceName = "CHAT_MSG_SEQ", allocationSize = 1)
    private Long id;

    // [기존 코드 유지]
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "POPUP_ID")
    private PopupStore popupStore;

    private String sender;
    private String message;
    private LocalDateTime sendTime;

    // 생성자
    public ChatMessage(PopupStore popupStore, String sender, String message) {
        this.popupStore = popupStore;
        this.sender = sender;
        this.message = message;
        this.sendTime = LocalDateTime.now();
    }
}