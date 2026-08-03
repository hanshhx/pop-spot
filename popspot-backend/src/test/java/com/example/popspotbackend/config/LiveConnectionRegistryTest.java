package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

/**
 * 비상 스위치가 <b>실제로</b> 연결을 끊는지 확인한다.
 *
 * <p>이 기능의 유일한 실패 방식은 "끊었다고 표시되는데 안 끊긴 것" 이다. 토큰을 철회했다고 안심하는 동안 공격자의 연결이 살아 있는 상태가 가장 위험하다.
 */
class LiveConnectionRegistryTest {

    private LiveConnectionRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new LiveConnectionRegistry();
    }

    private WebSocketSession openSession(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        return session;
    }

    @Test
    @DisplayName("그 사용자의 연결만 끊는다 — 남의 연결까지 끊으면 서비스가 멈춘다")
    void disconnectsOnlyTargetUser() throws IOException {
        WebSocketSession mine = openSession("s1");
        WebSocketSession other = openSession("s2");
        registry.register(mine);
        registry.register(other);
        registry.bind("me", "s1");
        registry.bind("someone-else", "s2");

        int closed = registry.disconnectUser("me");

        assertThat(closed).isEqualTo(1);
        verify(mine).close(any(CloseStatus.class));
        verify(other, never()).close(any(CloseStatus.class));
    }

    @Test
    @DisplayName("한 사람이 여러 기기로 붙어 있으면 전부 끊는다")
    void disconnectsEveryDeviceOfUser() throws IOException {
        WebSocketSession phone = openSession("s1");
        WebSocketSession laptop = openSession("s2");
        registry.register(phone);
        registry.register(laptop);
        registry.bind("me", "s1");
        registry.bind("me", "s2");

        assertThat(registry.disconnectUser("me")).isEqualTo(2);
        verify(phone).close(any(CloseStatus.class));
        verify(laptop).close(any(CloseStatus.class));
    }

    @Test
    @DisplayName("인증 전에 끊긴 연결은 아무에게도 묶이지 않는다 — 주인 없는 세션이 남의 폐기에 딸려가면 안 된다")
    void unboundSessionIsNotDisconnected() throws IOException {
        WebSocketSession anonymous = openSession("s1");
        registry.register(anonymous); // bind 없음 — STOMP CONNECT 전에 끊긴 경우

        assertThat(registry.disconnectUser("me")).isZero();
        verify(anonymous, never()).close(any(CloseStatus.class));
    }

    @Test
    @DisplayName("끊기 실패한 연결이 있어도 나머지는 끊는다")
    void oneFailureDoesNotStopTheRest() throws IOException {
        WebSocketSession broken = openSession("s1");
        WebSocketSession healthy = openSession("s2");
        org.mockito.Mockito.doThrow(new IOException("이미 닫힘")).when(broken).close(any());
        registry.register(broken);
        registry.register(healthy);
        registry.bind("me", "s1");
        registry.bind("me", "s2");

        // 하나가 터져도 예외가 밖으로 나가지 않고 나머지는 끊긴다.
        assertThat(registry.disconnectUser("me")).isEqualTo(1);
        verify(healthy).close(any(CloseStatus.class));
    }

    @Test
    @DisplayName("연결이 닫히면 지도에서 사라진다 — 죽은 세션이 쌓이면 메모리 누수다")
    void unregisterRemovesFromBothMaps() throws IOException {
        WebSocketSession session = openSession("s1");
        registry.register(session);
        registry.bind("me", "s1");

        registry.unregister("s1");

        assertThat(registry.disconnectUser("me")).isZero();
        verify(session, never()).close(any(CloseStatus.class));
    }

    @Test
    @DisplayName("이미 닫힌 연결은 세지 않는다 — 끊은 개수가 부풀면 안 된다")
    void alreadyClosedIsNotCounted() {
        WebSocketSession closed = mock(WebSocketSession.class);
        when(closed.getId()).thenReturn("s1");
        when(closed.isOpen()).thenReturn(false);
        registry.register(closed);
        registry.bind("me", "s1");

        assertThat(registry.disconnectUser("me")).isZero();
    }
}
