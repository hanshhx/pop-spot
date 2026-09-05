package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * <b>모든 컨트롤러는 공개인지 아닌지가 명시돼 있어야 한다.</b>
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>{@code SecurityConfig} 는 {@code /api/**} 전체를 {@code permitAll} 로 두고, 비공개 기능은 각 컨트롤러의
 * {@code @PreAuthorize} 에 의존한다. 지금 민감한 기능은 대부분 방어가 있지만, 이 구조에서는 <b>새 컨트롤러를 만들면서 어노테이션 하나를 빠뜨리면 그
 * API 가 조용히 공개된다</b>. 오류도 경고도 나지 않는다 — 동작하기 때문이다.
 *
 * <p>기존 {@code PrivateEndpointAuthorizationTest} 는 <b>손으로 적은 목록</b>이 지켜지는지만 본다. 목록에 없는 새 컨트롤러는 그냥
 * 통과한다. 이 검사가 그 빈틈을 막는다.
 *
 * <h3>규칙</h3>
 *
 * <p>매핑이 하나라도 있는 {@code @RestController} 는 다음 셋 중 <b>정확히 하나</b>여야 한다.
 *
 * <ol>
 *   <li>클래스에 {@code @PreAuthorize} — 통째로 보호된다. 목록에 적을 필요 없다.
 *   <li>{@link #FULLY_PUBLIC} 에 있음 — 모든 매핑이 공개다. 가드가 하나라도 생기면 검사가 실패하고 {@link #MIXED} 로 옮기라고 알린다.
 *   <li>{@link #MIXED} 에 있음 — 일부만 공개다. 메서드 가드가 전부 사라지면 검사가 실패한다.
 * </ol>
 *
 * <p>셋 중 어디에도 없으면 실패한다. <b>새 컨트롤러를 만든 사람이 공개 여부를 판단해 적게 만드는 것</b>이 이 검사의 목적이다 — 판단을 안 한 채 배포되는 일을
 * 막는다.
 */
class ControllerAuthorizationInventoryTest {

    private static final String BASE_PACKAGE = "com.example.popspotbackend";

    /**
     * 모든 매핑이 공개인 컨트롤러. 각 줄의 근거를 함께 남긴다.
     *
     * <p>여기 있다고 "안전하다" 는 뜻이 아니라 <b>공개가 의도된 것</b>이라는 뜻이다. 개별 엔드포인트의 소유권 검사(남의 자원을 보는가)는 이 검사의 범위가
     * 아니다.
     */
    private static final Set<String> FULLY_PUBLIC =
            Set.of(
                    "AiSearchController", // 검색 — 로그인 없이 쓰는 기능
                    "ChatController", // 팝업 상세의 채팅 읽기·티커. 쓰기는 WebSocket 쪽
                    "ClientErrorController", // 브라우저가 보내는 오류 보고. 인증 전에도 나야 한다
                    "CongestionController", // 혼잡도 조회
                    "CourseController", // 코스 추천(AI). 저장은 MyCourseController(보호됨)
                    "GoodsController", // 굿즈 조회만 남았다. 어드민 목록은 AdminController 로 옮겼다
                    "MusicController", // 팝업 배경음 조회
                    "PlanningController", // ⚠ 폐기된 작전지도. 코드가 살아 있어 여기 남는다
                    "PopupMapController", // 지도 마커
                    "PopupStoreController", // 팝업 목록·상세 — 사이트의 본체
                    "PopupWaitController", // 대기 정보 조회
                    "TmapController", // 경로 안내 프록시
                    "TrendController", // 급상승 검색어
                    "VisitController" // 방문 집계 수신. 비로그인 방문도 세야 한다
                    );

    /** 일부 매핑만 공개인 컨트롤러. 어느 메서드가 보호되는지는 {@code PrivateEndpointAuthorizationTest} 가 이름으로 못박는다. */
    private static final Set<String> MIXED =
            Set.of(
                    "AuthController", // 로그인·회원가입은 공개, /me 는 보호
                    "FeedbackController", // 보내기는 공개, 내 것 보기는 보호
                    "GameController", // 조회는 공개, 시작·예약은 보호
                    "SearchController", // 추천은 공개, 나머지는 보호
                    "SpotifyAuthController", // 콜백은 공개, 연결·해제는 보호
                    "TermsController", // 약관 조회는 공개, 동의·철회는 보호
                    "UserProfileController" // 공개 프로필 조회 외에는 보호
                    );

    @Test
    @DisplayName("모든 컨트롤러가 공개 여부로 분류돼 있다")
    void everyControllerIsClassified() {
        List<String> unclassified = new ArrayList<>();

        for (Class<?> controller : mappedControllers()) {
            String name = controller.getSimpleName();
            if (controller.getAnnotation(PreAuthorize.class) != null) continue; // 통째로 보호됨
            if (FULLY_PUBLIC.contains(name) || MIXED.contains(name)) continue;
            unclassified.add(name);
        }

        assertThat(unclassified)
                .describedAs(
                        "공개 여부가 분류되지 않은 컨트롤러가 있다. 클래스에 @PreAuthorize 를 붙이거나,"
                                + " ControllerAuthorizationInventoryTest 의 FULLY_PUBLIC/MIXED 에"
                                + " 근거와 함께 적을 것")
                .isEmpty();
    }

    /**
     * 공개로 분류해 둔 컨트롤러에 가드가 생기면 분류가 낡은 것이다. 그대로 두면 "여기는 전부 공개" 라는 표가 사실과 달라져, 다음 사람이 그 표를 믿고 잘못 판단한다.
     */
    @Test
    @DisplayName("전부 공개로 분류한 컨트롤러에는 가드가 없다")
    void fullyPublicControllersHaveNoGuards() {
        for (Class<?> controller : mappedControllers()) {
            if (!FULLY_PUBLIC.contains(controller.getSimpleName())) continue;

            assertThat(guardedMethodNames(controller))
                    .describedAs(
                            "%s 는 FULLY_PUBLIC 인데 가드가 붙었다 — MIXED 로 옮길 것",
                            controller.getSimpleName())
                    .isEmpty();
        }
    }

    /** 반대쪽. 섞였다고 적어 둔 곳에서 가드가 전부 사라지면 그것도 분류가 틀린 것이다. */
    @Test
    @DisplayName("일부 공개로 분류한 컨트롤러에는 가드가 남아 있다")
    void mixedControllersKeepGuards() {
        for (Class<?> controller : mappedControllers()) {
            if (!MIXED.contains(controller.getSimpleName())) continue;

            assertThat(guardedMethodNames(controller))
                    .describedAs(
                            "%s 는 MIXED 인데 가드가 하나도 없다 — 실수로 지웠는지 확인할 것", controller.getSimpleName())
                    .isNotEmpty();
        }
    }

    /** 표에 적힌 이름이 실제로 존재하는지. 컨트롤러를 지웠는데 표만 남는 것을 막는다. */
    @Test
    @DisplayName("표에 적힌 컨트롤러가 실제로 존재한다")
    void listedControllersExist() {
        Set<String> actual =
                mappedControllers().stream()
                        .map(Class::getSimpleName)
                        .collect(Collectors.toCollection(TreeSet::new));

        Set<String> listed = new TreeSet<>(FULLY_PUBLIC);
        listed.addAll(MIXED);
        listed.removeAll(actual);

        assertThat(listed).describedAs("사라진 컨트롤러가 표에 남아 있다").isEmpty();
    }

    /* ============================== 내부 ============================== */

    /** 매핑이 하나라도 있는 {@code @RestController}. 조언(advice) 클래스는 매핑이 없어 빠진다. */
    private static List<Class<?>> mappedControllers() {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));

        List<Class<?>> found = new ArrayList<>();
        for (BeanDefinition definition : scanner.findCandidateComponents(BASE_PACKAGE)) {
            try {
                Class<?> type = Class.forName(definition.getBeanClassName());
                if (hasMapping(type)) found.add(type);
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("스캔한 클래스를 못 읽었다", e);
            }
        }
        assertThat(found).describedAs("컨트롤러를 하나도 못 찾았다 — 스캐너가 고장난 것").isNotEmpty();
        return found;
    }

    private static boolean hasMapping(Class<?> type) {
        return Arrays.stream(type.getDeclaredMethods())
                .anyMatch(ControllerAuthorizationInventoryTest::isMapping);
    }

    private static boolean isMapping(Method method) {
        return method.getAnnotation(GetMapping.class) != null
                || method.getAnnotation(PostMapping.class) != null
                || method.getAnnotation(PutMapping.class) != null
                || method.getAnnotation(DeleteMapping.class) != null
                || method.getAnnotation(PatchMapping.class) != null
                || method.getAnnotation(RequestMapping.class) != null;
    }

    private static List<String> guardedMethodNames(Class<?> controller) {
        return Arrays.stream(controller.getDeclaredMethods())
                .filter(m -> m.getAnnotation(PreAuthorize.class) != null)
                .map(Method::getName)
                .sorted()
                .toList();
    }
}
