package com.example.popspotbackend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * [로직 구조 해석]
 * 1. @Configuration: 이 클래스가 스프링의 설정 파일(Bean 설정)임을 명시합니다.
 * 2. @EnableWebSocketMessageBroker: STOMP 프로토콜을 기반으로 하는 메시지 브로커를 활성화합니다.
 * - 이를 통해 실시간 채팅 및 알림 기능을 사용할 수 있게 됩니다.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * [메서드 해석] registerStompEndpoints: 웹소켓 연결을 위한 엔드포인트(URL)를 등록합니다.
     * 클라이언트(React 등)가 처음 소켓 연결을 시도할 때 이 주소로 Handshake(HTTP 요청)를 보냅니다.
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 1. 일반 알림 및 채팅용 엔드포인트 (/ws-stomp)
        registry.addEndpoint("/ws-stomp")
                // 🔥 [임의 수정 사항] setAllowedOriginPatterns를 "*"로 변경하여 모든 오리진을 허용합니다.
                // Vercel의 불규칙한 Preview URL이나 도메인 변경 시 발생하는 CORS 403 에러를 완벽하게 차단하는 로직입니다.
                .setAllowedOriginPatterns("*")
                // withSockJS: 웹소켓을 지원하지 않는 구형 브라우저에서도 통신이 가능하도록 SockJS 라이브러리를 지원합니다.
                .withSockJS();

        // 2. 작전 회의실용 엔드포인트 (/ws-planning)
        registry.addEndpoint("/ws-planning")
                // 🔥 [임의 수정 사항] 위와 동일하게 모든 도메인 패턴을 허용하도록 수정했습니다.
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    /**
     * [메서드 해석] configureMessageBroker: 메시지가 전달되는 경로와 브로커를 설정하는 구조입니다.
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 1. enableSimpleBroker: 서버가 클라이언트에게 메시지를 쏴줄 때 사용하는 "구독(Subscribe)" 경로의 접두사입니다.
        // 클라이언트가 이 경로를 지켜보고(Listen) 있으면 서버가 데이터를 전달합니다.
        registry.enableSimpleBroker("/sub", "/topic");

        // 2. setApplicationDestinationPrefixes: 클라이언트가 서버로 메시지를 보낼 때 사용하는 "발행(Publish)" 경로의 접두사입니다.
        // @MessageMapping 어노테이션이 붙은 컨트롤러로 메시지를 라우팅하는 기준이 됩니다.
        registry.setApplicationDestinationPrefixes("/pub", "/app");
    }
}