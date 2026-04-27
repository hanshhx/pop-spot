package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.CourseSaveRequestDto;
import com.example.popspotbackend.entity.MyCourse;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.MyCourseRepository;
import com.example.popspotbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MyCourseService {

    private final MyCourseRepository myCourseRepository;
    private final UserRepository userRepository;

    @Transactional
    public void saveCourse(CourseSaveRequestDto dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new RuntimeException("유저 없음"));

        // 무료 유저는 슬롯이 1개뿐 (기존 것 삭제 후 저장)
        if (!user.isPremium()) {
            List<MyCourse> existingCourses = myCourseRepository.findAllByUserId(dto.getUserId());
            if (!existingCourses.isEmpty()) {
                myCourseRepository.deleteAll(existingCourses);
                System.out.println("♻️ [Free User] 기존 코스를 삭제하고 새로운 코스로 덮어씁니다.");
            }
        }

        MyCourse myCourse = MyCourse.builder()
                .userId(dto.getUserId())
                .courseName(dto.getCourseName())
                .courseData(dto.getCourseData())
                .build();

        myCourseRepository.save(myCourse);
    }

    @Transactional(readOnly = true)
    public List<MyCourse> getMyCourses(String userId) {
        return myCourseRepository.findAllByUserId(userId);
    }

    // 🔥 [추가됨] 삭제 비즈니스 로직
    @Transactional
    public void deleteCourse(Long courseId) {
        myCourseRepository.deleteById(courseId);
    }
}