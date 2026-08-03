package com.example.popspotbackend.controller;

import com.example.popspotbackend.config.AdminAuditInterceptor;
import com.example.popspotbackend.entity.AdminAuditLog;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.admin.AdminAuditService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 가려진 이메일을 <b>한 건씩</b> 여는 문.
 *
 * <p>관리자 화면은 이메일을 가려서 보여 준다. 그런데 가끔 전체 주소가 정말 필요하다 — 가려진 값이 두 명 이상과 겹칠 때, 그리고 게스트 의견에 답신을 보낼 때다(이
 * 서비스에는 게스트 답신 경로가 자체로 없어서 관리자가 직접 메일을 쓴다).
 *
 * <p><b>문을 만드는 이유가 문을 잠그는 이유보다 중요하다.</b> 해제 경로가 없으면 관리자는 DB 콘솔로 간다. 거기엔 감사도, 한도도, 마스킹도 없다. 마스킹이 만들
 * 수 있는 최악의 결과가 그것이다.
 *
 * <p>조회인데 {@code POST} 인 것은 실수가 아니다. {@code AdminAuditInterceptor} 가 GET 이 아닌 관리자 요청을 <b>전부</b>
 * 남기므로, POST 로 두는 것만으로 "해제 1회 = 감사 1줄" 이 설정 없이 성립한다. GET 으로 만들면 조회 허용 목록을 손으로 관리해야 하고 언젠가 빠뜨린다. 이
 * 요청이 바꾸는 것이 하나 있는데, 그게 <b>기록</b>이다.
 */
@RestController
@RequestMapping("/api/admin/reveal")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminPiiRevealController {

    private final UserRepository userRepository;
    private final AdminAuditService adminAudit;

    /** 회원 이메일 1건. 가려진 값이 여러 명과 겹칠 때만 쓴다. */
    @PostMapping("/users/{userId}/email")
    public ResponseEntity<Map<String, String>> revealUserEmail(
            @PathVariable String userId, HttpServletRequest request) {

        String email =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId))
                        .getEmail();

        recordOrRefuse(request, userId, "회원 이메일");
        return ResponseEntity.ok(Map.of("email", email == null ? "" : email));
    }

    /**
     * 감사 기록을 <b>먼저, 동기로</b> 남긴다. 실패하면 이메일을 돌려주지 않는다.
     *
     * <p>평소 감사 기록은 인터셉터가 응답이 나간 <b>뒤에</b> 남기고, 실패해도 삼킨다 — 곁다리가 본체를 붙잡으면 안 되기 때문이다. 그 판단은 대부분의
     * 엔드포인트에서 맞다.
     *
     * <p>그런데 이 엔드포인트만은 반대다. 여기서 파는 것이 정확히 "조용한 대량 유출을 시끄러운 건별 유출로 바꾼다" 인데, 그 시끄러움이 best-effort 면 판
     * 물건이 없는 것이다. 기록이 실패했는데 이메일은 나가는 조합은 <b>가장 나쁜 결과</b>다 — 유출은 일어났고 흔적은 없다. 그래서 이 한 곳만 fail-closed
     * 다.
     *
     * <p>인터셉터가 이중으로 남기지 않도록 '기록함' 표시를 미리 심는다.
     */
    private void recordOrRefuse(HttpServletRequest request, String targetId, String what) {
        adminAudit.recordOrThrow(
                currentActorId(),
                request.getMethod() + " " + request.getRequestURI(),
                AdminAuditLog.TARGET_MEMBER_DATA,
                targetId,
                true,
                200,
                what);
        AdminAuditInterceptor.markRecorded(request);
    }

    private static String currentActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : auth.getName();
    }
}
