package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.AiCourseService; // 방금 만든 서비스 import
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class CourseController {

    private final AiCourseService aiCourseService;

    @GetMapping("/recommend")
    public ResponseEntity<?> recommend(@RequestParam String vibe) {
        // 실제 AI 서비스 호출
        List<Map<String, Object>> course = aiCourseService.recommendCourse(vibe);
        return ResponseEntity.ok(course);
    }
}