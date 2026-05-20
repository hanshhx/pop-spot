package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.CourseSaveRequestDto;
import com.example.popspotbackend.dto.MyCourseResponseDto;
import com.example.popspotbackend.service.MyCourseService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 코스 저장 / 조회 / 삭제.
 *
 * <p>v2.9 보안: 모든 엔드포인트가 토큰 subject 와 요청 userId 의 일치를 검증. 불일치는
 * {@link SecurityException} → GlobalExceptionHandler 403. 무료 회원의 1 슬롯 제한은 서비스가
 * 자동으로 기존 코스를 덮어쓰는 방식으로 처리하므로 별도 예외 / 클라이언트 가드는 없다.
 */
@RestController
@RequestMapping("/api/my-courses")
@RequiredArgsConstructor
public class MyCourseController {

    private final MyCourseService myCourseService;

    @PostMapping
    public ResponseEntity<String> saveCourse(
            Authentication authentication, @RequestBody CourseSaveRequestDto dto) {
        requireSelf(authentication, dto.getUserId());
        myCourseService.saveCourse(dto);
        return ResponseEntity.ok("코스 저장 완료!");
    }

    @GetMapping
    public ResponseEntity<List<MyCourseResponseDto>> getMyCourses(
            Authentication authentication, @RequestParam String userId) {
        requireSelf(authentication, userId);
        return ResponseEntity.ok(
                myCourseService.getMyCourses(userId).stream()
                        .map(MyCourseResponseDto::fromEntity)
                        .toList());
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<String> deleteCourse(
            Authentication authentication, @PathVariable Long courseId) {
        myCourseService.deleteCourseAsOwner(courseId, requireAuthenticated(authentication));
        return ResponseEntity.ok("삭제 완료");
    }

    /* ============================== 인증 헬퍼 ============================== */

    private void requireSelf(Authentication authentication, String requestUserId) {
        String tokenUserId = requireAuthenticated(authentication);
        if (!tokenUserId.equals(requestUserId)) {
            throw new SecurityException("본인 코스만 접근할 수 있습니다.");
        }
    }

    private String requireAuthenticated(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null) {
            throw new SecurityException("인증된 사용자만 코스에 접근할 수 있습니다.");
        }
        return authentication.getName();
    }
}
