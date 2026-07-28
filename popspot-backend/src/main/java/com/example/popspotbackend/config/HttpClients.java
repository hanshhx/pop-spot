package com.example.popspotbackend.config;

import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * 외부 API 호출용 {@link RestTemplate} 을 <b>타임아웃이 걸린 채로</b> 만든다.
 *
 * <p>{@code new RestTemplate()} 의 기본값은 <b>무한 대기</b>다. 상대 서버가 응답을 주지 않으면 그 요청을 처리하던 스레드가 영영 붙잡히고, 톰캣
 * 스레드 풀이 차면 서비스 전체가 멈춘다. 실제로 결제·검색·사진· 음악·크롤러 등 14곳이 전부 이 상태였다.
 *
 * <p>빈으로 만들어 주입하지 않고 정적 헬퍼로 둔 것은, 기존 코드가 모두 {@code private final RestTemplate restTemplate = new
 * RestTemplate();} 형태의 필드 초기화라서다. 호출 지점만 바꾸면 되므로 주입 구조·빈 생성 순서를 건드리지 않는다.
 *
 * <p>타임아웃 값은 넉넉하되 무한은 아니게 잡는다. 연결은 상대가 살아 있는지 확인하는 시간이라 짧아도 되고, 읽기는 상대가 일을 하는 시간이라 그보다 길어야 한다.
 */
public final class HttpClients {

    /** 연결 수립까지. 살아 있는 서버라면 이보다 오래 걸릴 이유가 없다. */
    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);

    /** 응답 본문까지. 검색·결제 API 가 느릴 때를 감안한 값이다. */
    private static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(10);

    private HttpClients() {}

    /** 기본 타임아웃(연결 5초 · 읽기 10초). */
    public static RestTemplate withTimeouts() {
        return withTimeouts(DEFAULT_CONNECT_TIMEOUT, DEFAULT_READ_TIMEOUT);
    }

    /** 호출처가 특별히 느리거나 빨라야 할 때. */
    public static RestTemplate withTimeouts(Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return new RestTemplate(factory);
    }
}
