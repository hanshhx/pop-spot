package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * D-3 — <b>보안 기록과 분석 기록을 서로 다른 문턱 뒤에 둔다.</b>
 *
 * <p>관리자가 한 명이라 역할을 쪼개는 것은 아직 의미가 없다(그건 두 번째 관리자가 생길 때, D-4). 대신 <b>같은 계정이라도 무엇을 보느냐에 따라 요구하는 증명을
 * 다르게</b> 한다. 그러면 세션이 탈취돼도 공격자가 얻는 것이 방문 통계까지로 줄어든다.
 *
 * <p>가르는 기준은 "탈취된 세션이 그것으로 무엇을 할 수 있는가" 다.
 *
 * <ul>
 *   <li>감사 로그 — 관리자가 <b>어디서 접속하는지</b>가 적혀 있다. 그걸 읽고 그 IP 를 차단하면 진짜 관리자를 밀어낼 수 있다. 읽기까지 막아야 이 연결고리가
 *       끊긴다.
 *   <li>IP 차단 — 진짜 관리자를 잠그거나 자기를 풀 수 있다.
 *   <li>방문 통계 — 훔쳐봐도 할 수 있는 일이 없다. 자주 보는 화면이라 마찰을 걸면 안 된다.
 * </ul>
 */
class AdminReauthScopeTest {

    @Test
    @DisplayName("감사 로그는 읽기도 재확인 대상 — 여기에 관리자 접속지가 적혀 있다")
    void auditReadsNeedReauth() {
        assertThat(AdminReauthInterceptor.needsReauth("GET", "/api/admin/audit")).isTrue();
        assertThat(AdminReauthInterceptor.needsReauth("GET", "/api/admin/audit/overview")).isTrue();
    }

    @Test
    @DisplayName("IP 차단은 읽기·쓰기 모두 재확인 대상")
    void ipBlockNeedsReauthForEveryMethod() {
        for (String method : new String[] {"GET", "POST", "DELETE"}) {
            assertThat(AdminReauthInterceptor.needsReauth(method, "/api/admin/security/ip-blocks"))
                    .describedAs("%s 로 우회할 수 있으면 안 된다", method)
                    .isTrue();
        }
    }

    @Test
    @DisplayName("방문 통계·지표는 재확인 없이 본다 — 자주 보는 화면에 마찰을 걸면 우회를 만든다")
    void analyticsStaysOpen() {
        assertThat(AdminReauthInterceptor.needsReauth("GET", "/api/admin/visits/stats")).isFalse();
        assertThat(AdminReauthInterceptor.needsReauth("GET", "/api/admin/visits/funnel")).isFalse();
        assertThat(AdminReauthInterceptor.needsReauth("GET", "/api/admin/metrics")).isFalse();
    }

    /**
     * 비상 스위치는 <b>문턱 뒤에 두지 않는다.</b>
     *
     * <p>토큰이 샜다고 의심되는 순간에 쓰는 것이라, 앞에 문을 하나 더 두면 비상용이 아니게 된다. 게다가 이 동작은 파괴적이지 않다 — 공격자가 눌러 봐야 전원
     * 로그아웃일 뿐이다.
     *
     * <p>{@code WebConfig} 가 같은 이유로 이 경로를 정책 동의 검사에서도 빼 두고 있다.
     */
    @Test
    @DisplayName("전체 로그아웃은 재확인 대상이 아니다 — 비상 스위치 앞에 문을 두면 안 된다")
    void emergencyLeverStaysReachable() {
        assertThat(AdminReauthInterceptor.needsReauth("POST", "/api/admin/session/revoke-all"))
                .isFalse();
    }

    @Test
    @DisplayName("기존의 되돌릴 수 없는 작업은 그대로 재확인 대상")
    void destructiveActionsStillNeedReauth() {
        assertThat(AdminReauthInterceptor.needsReauth("POST", "/api/admin/chat/delete-batch"))
                .isTrue();
        assertThat(AdminReauthInterceptor.needsReauth("POST", "/api/admin/totp/disable")).isTrue();
        assertThat(AdminReauthInterceptor.needsReauth("DELETE", "/api/admin/mate-posts/12"))
                .isTrue();
    }

    @Test
    @DisplayName("되돌릴 수 있는 일상 작업은 그대로 통과 — 승인 한 건마다 6자리를 물으면 화면을 안 쓴다")
    void reversibleActionsStayOpen() {
        assertThat(AdminReauthInterceptor.needsReauth("POST", "/api/admin/popups/1/approve"))
                .isFalse();
        assertThat(AdminReauthInterceptor.needsReauth("POST", "/api/admin/popups/crawl")).isFalse();
    }
}
