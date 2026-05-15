package com.example.popspotbackend.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 팝업별 라이브 채팅 메시지 (`/ws-stomp` 로 브로드캐스트).
 *
 * <p>{@link PopupStore} 와의 fetch 가 EAGER 인 이유: WebSocket broadcast 가 트랜잭션 밖에서 직렬화되므로 LAZY 면 {@code
 * LazyInitializationException} 이 터진다. lazy 컬렉션은 {@link JsonIgnoreProperties} 로 직렬화 제외.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "chat_msg_seq_gen")
    @SequenceGenerator(name = "chat_msg_seq_gen", sequenceName = "CHAT_MSG_SEQ", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "POPUP_ID")
    @JsonIgnoreProperties({
        "images",
        "imageUrl",
        "stamps",
        "reviews",
        "comments",
        "hibernateLazyInitializer",
        "handler"
    })
    private PopupStore popupStore;

    private String sender;
    private String message;
    private LocalDateTime sendTime;

    public ChatMessage(PopupStore popupStore, String sender, String message) {
        this.popupStore = popupStore;
        this.sender = sender;
        this.message = message;
        this.sendTime = LocalDateTime.now();
    }
}
