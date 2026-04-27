package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.CourseSaveRequestDto;
import com.example.popspotbackend.entity.MyCourse;
import com.example.popspotbackend.service.MyCourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/my-courses")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class MyCourseController {

    private final MyCourseService myCourseService;

    @PostMapping
    public ResponseEntity<String> saveCourse(@RequestBody CourseSaveRequestDto dto) {
        try {
            myCourseService.saveCourse(dto);
            return ResponseEntity.ok("코스 저장 완료!");
        } catch (RuntimeException e) {
            if (e.getMessage().equals("LIMIT_REACHED")) {
                return ResponseEntity.status(403).body("LIMIT_REACHED");
            }
            return ResponseEntity.status(500).body("저장 실패");
        }
    }

    @GetMapping
    public ResponseEntity<List<MyCourse>> getMyCourses(@RequestParam String userId) {
        return ResponseEntity.ok(myCourseService.getMyCourses(userId));
    }

    // 🔥 [추가됨] 코스 삭제 API
    @DeleteMapping("/{courseId}")
    public ResponseEntity<String> deleteCourse(@PathVariable Long courseId) {
        myCourseService.deleteCourse(courseId);
        return ResponseEntity.ok("삭제 완료");
    }
}