package com.example.popspotbackend.exception;

/**
 * 요청한 도메인 리소스(User · PopupStore · MatePost 등)를 찾지 못했을 때 던지는 예외.
 *
 * <p>서비스 레이어에서 {@code findById(...).orElseThrow(...)} 같은 패턴에 사용한다. {@link GlobalExceptionHandler} 가
 * 이 예외를 잡아 HTTP 404 응답으로 변환.
 *
 * <p>기존에 {@code new RuntimeException("유저 없음")} 식으로 던지던 케이스를 도메인 의미가 있는 예외로 격상하면, 컴파일러가 호출 지점을 추적할 수
 * 있고 메시지 포맷도 일관되게 유지된다.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException user(String userId) {
        return new ResourceNotFoundException("User not found: " + userId);
    }

    public static ResourceNotFoundException popup(Long popupId) {
        return new ResourceNotFoundException("Popup not found: " + popupId);
    }

    public static ResourceNotFoundException matePost(Long postId) {
        return new ResourceNotFoundException("MatePost not found: " + postId);
    }

    public static ResourceNotFoundException musicTrack(Long trackId) {
        return new ResourceNotFoundException("MusicTrack not found: " + trackId);
    }
}
