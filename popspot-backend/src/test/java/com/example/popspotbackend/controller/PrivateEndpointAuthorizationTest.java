package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

/** 공개 {@code /api/**} 규칙 아래에서 개인정보·쓰기 API의 메서드 보안 표시가 빠지는 회귀를 막는다. */
class PrivateEndpointAuthorizationTest {

    private static final List<Class<?>> PRIVATE_CONTROLLERS =
            List.of(
                    WishlistController.class,
                    MyPageController.class,
                    MyCourseController.class,
                    StampController.class);

    private static final Map<Class<?>, List<String>> PRIVATE_METHODS =
            Map.of(
                    AuthController.class, List.of("getCurrentUser"),
                    GameController.class, List.of("startSimulation", "reserve"),
                    FeedbackController.class, List.of("getMine"),
                    TermsController.class, List.of("accept", "decline"),
                    UserProfileController.class, List.of("uploadAvatar", "updateMe", "deleteMe"),
                    SpotifyAuthController.class, List.of("login", "disconnect", "token"));

    @Test
    @DisplayName("회원 전용 컨트롤러는 클래스 수준에서 인증을 요구한다")
    void privateControllersRequireAuthentication() {
        for (Class<?> controller : PRIVATE_CONTROLLERS) {
            PreAuthorize guard = controller.getAnnotation(PreAuthorize.class);
            assertThat(guard)
                    .describedAs("%s에 @PreAuthorize 누락", controller.getSimpleName())
                    .isNotNull();
            assertThat(guard.value()).isEqualTo("isAuthenticated()");
        }
    }

    @Test
    @DisplayName("공개·비공개가 섞인 컨트롤러의 회원 전용 메서드는 인증을 요구한다")
    void privateMethodsRequireAuthentication() {
        PRIVATE_METHODS.forEach(
                (controller, methodNames) -> {
                    for (String methodName : methodNames) {
                        Method method = findUniqueMethod(controller, methodName);
                        PreAuthorize guard = method.getAnnotation(PreAuthorize.class);
                        assertThat(guard)
                                .describedAs(
                                        "%s.%s에 @PreAuthorize 누락",
                                        controller.getSimpleName(), methodName)
                                .isNotNull();
                        assertThat(guard.value()).isEqualTo("isAuthenticated()");
                    }
                });
    }

    private static Method findUniqueMethod(Class<?> controller, String methodName) {
        List<Method> matches =
                java.util.Arrays.stream(controller.getDeclaredMethods())
                        .filter(method -> method.getName().equals(methodName))
                        .toList();
        assertThat(matches)
                .describedAs("%s.%s 메서드 수", controller.getSimpleName(), methodName)
                .hasSize(1);
        return matches.getFirst();
    }
}
