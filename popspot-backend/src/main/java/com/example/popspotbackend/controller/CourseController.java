package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.AiCourseService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** vibe 키워드로 AI 가 생성한 데이트 코스를 반환한다. */
@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final AiCourseService aiCourseService;

    @GetMapping("/recommend")
    public ResponseEntity<List<Map<String, Object>>> recommend(@RequestParam String vibe) {
        return ResponseEntity.ok(aiCourseService.recommendCourse(vibe));
    }
}
