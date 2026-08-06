package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.controller.AdminIpBlockController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.PathContainer;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

/**
 * 차단 <b>잠금 탈출구</b>가 실제로 열려 있는지 확인한다.
 *
 * <p>관리자의 IP 는 바뀌고, 예전에 걸어 둔 주소를 나중에 다시 배정받는 일이 실제로 있다. 그때 차단 관리 경로까지 막히면 스스로 풀 방법이 없어져 서버에 직접 들어가야
 * 한다.
 *
 * <p><b>이 고장은 잠긴 뒤에야 드러난다.</b> 경로를 바꾸거나 오타를 내도 평소에는 아무 증상이 없고, 정작 필요한 순간에만 없다. 그래서 매칭 규칙 자체를 테스트로
 * 고정한다 — 손으로 눈대중하면 {@code /**} 가 <b>자기 자신</b>을 덮는지 같은 것을 틀리기 쉽다.
 */
class IpBlockEscapeHatchTest {

    private static final PathPattern HATCH =
            new PathPatternParser().parse(WebConfig.IP_BLOCK_ADMIN_PATTERN);

    private static boolean covers(String path) {
        return HATCH.matches(PathContainer.parsePath(path));
    }

    /** 컨트롤러가 실제로 매핑한 경로. 여기서 읽어야 한쪽만 바뀌었을 때 테스트가 깨진다. */
    private static String controllerPath() {
        RequestMapping mapping = AdminIpBlockController.class.getAnnotation(RequestMapping.class);
        return mapping.value()[0];
    }

    @Test
    @DisplayName("탈출구가 차단 관리 경로 '그 자체' 를 덮는다 — /** 가 빈 구간도 덮는지가 핵심")
    void hatchCoversTheControllerPathItself() {
        // 여기가 틀리기 쉬운 자리다. 목록 조회와 해제는 하위 경로가 아니라 이 경로 그대로 부른다.
        assertThat(covers(controllerPath()))
                .describedAs("'%s' 가 '%s' 를 못 덮으면 잠겼을 때 풀 방법이 없다", HATCH, controllerPath())
                .isTrue();
    }

    @Test
    @DisplayName("하위 경로도 덮는다")
    void hatchCoversSubPaths() {
        assertThat(covers(controllerPath() + "/anything")).isTrue();
    }

    @Test
    @DisplayName("탈출구가 다른 관리자 경로까지 열지는 않는다 — 넓으면 차단이 통째로 무의미해진다")
    void hatchDoesNotOpenOtherAdminPaths() {
        // 제외 패턴이 넓으면 차단은 켜져 있는데 아무것도 안 막는 상태가 된다. 증상은 역시 없다.
        assertThat(covers("/api/admin/popups")).isFalse();
        assertThat(covers("/api/admin/security")).isFalse();
        assertThat(covers("/api/admin")).isFalse();
        assertThat(covers("/api/visits/events")).isFalse();
    }
}
