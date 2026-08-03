package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.MateService;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;

/**
 * 클라이언트가 브로커 주소로 직접 메시지를 보내지 못하게 막는지 검사한다.
 *
 * <p>이걸 막지 않으면 <b>컨트롤러가 통째로 우회된다.</b> STOMP 는 SEND 목적지가 브로커 주소여도 그대로 구독자에게 중계하므로, {@code
 * /sub/chat/room/12} 로 직접 보내면 보낸 사람 확정·내용 검증·DB 저장이 전부 건너뛰어진 메시지가 그 방을 보고 있는 모든 사람 화면에 뜬다. 조작된 시스템
 * 메시지, 남의 이름으로 된 채팅, 가짜 투표 결과를 심을 수 있다.
 *
 * <p>화면·빌드로는 드러나지 않는다 — 정상 클라이언트는 {@code /pub}, {@code /app} 만 쓰기 때문에 위조 경로는 사람이 직접 STOMP 프레임을 만들어
 * 봐야 보인다. 그래서 테스트로 고정한다.
 */
class WebSocketDestinationGuardTest {

    private ChannelInterceptor interceptor;
    private MessageChannel channel;

    @BeforeEach
    void setUp() {
        WebSocketConfig config =
                new WebSocketConfig(
                        mock(MateService.class),
                        mock(UserRepository.class),
                        new LiveConnectionRegistry());

        // 인터셉터는 private 내부 클래스라 등록 과정을 통해 꺼낸다.
        List<ChannelInterceptor> captured = new ArrayList<>();
        ChannelRegistration registration =
                new ChannelRegistration() {
                    @Override
                    public ChannelRegistration interceptors(ChannelInterceptor... interceptors) {
                        captured.addAll(List.of(interceptors));
                        return this;
                    }
                };
        config.configureClientInboundChannel(registration);
        interceptor = captured.get(0);
        channel = mock(MessageChannel.class);
    }

    private Message<byte[]> send(String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setDestination(destination);
        accessor.setSessionId("test-session");
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<byte[]> subscribe(String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        accessor.setSessionId("test-session");
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test
    @DisplayName("브로커 주소로 직접 보내면 거부한다 — 컨트롤러 우회 경로")
    void rejectsSendToBrokerDestinations() {
        for (String forged :
                List.of(
                        "/sub/chat/room/12",
                        "/sub/mate/chat/34",
                        "/topic/plan/room-abc",
                        "/sub",
                        "/topic")) {
            assertThatThrownBy(() -> interceptor.preSend(send(forged), channel), forged)
                    .isInstanceOf(SecurityException.class);
        }
    }

    @Test
    @DisplayName("정상 클라이언트가 쓰는 주소는 통과한다")
    void allowsApplicationDestinations() {
        // 프론트엔드가 실제로 보내는 곳(ChatRoom·planning).
        //
        // /pub/mate/chat/{id} 는 여기서 빼 둔다 — 목적지 검사는 통과하지만 그 뒤의 동행 참여자
        // 검사에 걸린다(MateService 목이 isParticipant=false). 그건 원래 있던 방어이고, 아래
        // rejectsMateChatForNonParticipant 에서 따로 확인한다.
        for (String ok :
                List.of(
                        "/pub/chat/message/12",
                        "/app/plan/room-abc/action",
                        "/app/plan/room-abc/vote")) {
            assertThatCode(() -> interceptor.preSend(send(ok), channel))
                    .describedAs(ok)
                    .doesNotThrowAnyException();
        }
    }

    @Test
    @DisplayName("동행 채널은 목적지 검사를 통과해도 참여자가 아니면 막힌다")
    void rejectsMateChatForNonParticipant() {
        // 목적지 검사를 넣으면서 기존 방어를 밀어내지 않았는지 확인한다.
        assertThatThrownBy(() -> interceptor.preSend(send("/pub/mate/chat/34"), channel))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    @DisplayName("모르는 주소는 기본 거부 — 빠뜨려도 열리지 않는 쪽으로 실패한다")
    void rejectsUnknownDestinations() {
        for (String unknown : List.of("/queue/anything", "/exchange/x", "/", "/pubx/chat")) {
            assertThatThrownBy(() -> interceptor.preSend(send(unknown), channel), unknown)
                    .isInstanceOf(SecurityException.class);
        }
    }

    @Test
    @DisplayName("구독은 브로커 주소로 계속 가능하다 — 막으면 채팅이 안 보인다")
    void stillAllowsSubscribeToBroker() {
        // MateService 목이 isParticipant=false 를 돌려주므로 동행 채널은 원래대로 막힌다.
        // 여기서 확인하는 것은 <b>목적지 검사가 구독을 건드리지 않는다</b>는 것이다.
        for (String ok : List.of("/sub/chat/room/12", "/topic/plan/room-abc")) {
            assertThatCode(() -> interceptor.preSend(subscribe(ok), channel))
                    .describedAs(ok)
                    .doesNotThrowAnyException();
        }
    }

    @Test
    @DisplayName("목적지 없는 프레임은 통과시킨다 — CONNECT·DISCONNECT 를 막으면 안 된다")
    void ignoresFramesWithoutDestination() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setSessionId("test-session");
        accessor.setLeaveMutable(true);
        Message<byte[]> noDestination =
                MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatCode(() -> interceptor.preSend(noDestination, channel))
                .doesNotThrowAnyException();
    }
}
