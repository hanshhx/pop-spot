package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.CourseSaveRequestDto;
import com.example.popspotbackend.entity.MyCourse;
import com.example.popspotbackend.service.MyCourseService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 내 코스 저장 / 조회 / 삭제. 저장 개수 상한 도달 시 서비스가 LIMIT_REACHED 를 던진다. */
@RestController
@RequestMapping("/api/my-courses")
@RequiredArgsConstructor
public class MyCourseController {

    private static final String ERROR_LIMIT_REACHED = "LIMIT_REACHED";

    private final MyCourseService myCourseService;

    @PostMapping
    public ResponseEntity<String> saveCourse(@RequestBody CourseSaveRequestDto dto) {
        try {
            myCourseService.saveCourse(dto);
            return ResponseEntity.ok("코스 저장 완료!");
        } catch (RuntimeException e) {
            if (ERROR_LIMIT_REACHED.equals(e.getMessage())) {
                return ResponseEntity.status(403).body(ERROR_LIMIT_REACHED);
            }
            return ResponseEntity.status(500).body("저장 실패");
        }
    }

    @GetMapping
    public ResponseEntity<List<MyCourse>> getMyCourses(@RequestParam String userId) {
        return ResponseEntity.ok(myCourseService.getMyCourses(userId));
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<String> deleteCourse(@PathVariable Long courseId) {
        myCourseService.deleteCourse(courseId);
        return ResponseEntity.ok("삭제 완료");
    }
}
