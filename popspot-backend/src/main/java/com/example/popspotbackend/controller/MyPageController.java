package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MyPageDto;
import com.example.popspotbackend.service.MyPageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 요약 API.
 *
 * <p>실제 로직은 {@link MyPageService} 가 처리하며, 컨트롤러는 URL 매핑만 담당. 예외 처리는 {@link
 * com.example.popspotbackend.exception.GlobalExceptionHandler} 가 전역 변환.
 */
@Slf4j
@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
public class MyPageController {

    private final MyPageService myPageService;

    @GetMapping("/{userId}")
    public ResponseEntity<MyPageDto> getMyPageInfo(@PathVariable String userId) {
        return ResponseEntity.ok(myPageService.findMyPageData(userId));
    }
}
