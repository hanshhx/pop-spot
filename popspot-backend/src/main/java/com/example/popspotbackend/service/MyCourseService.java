package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.CourseSaveRequestDto;
import com.example.popspotbackend.entity.MyCourse;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.MyCourseRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 코스 저장 / 조회 / 삭제.
 *
 * <p>v2.12 부터 모든 사용자가 코스를 무제한으로 저장한다. 이전에는 무료 유저 1개 제한이 있었으나, 포트폴리오 운영 단순화 + 사용자 경험 개선을 위해 폐지.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MyCourseService {

    private final MyCourseRepository myCourseRepository;
    private final UserRepository userRepository;

    @Transactional
    public void saveCourse(CourseSaveRequestDto dto) {
        // 유저 존재 검증만 수행 (잘못된 userId 로 저장 방지). 코스 수 제한은 없음.
        requireUserExists(dto.getUserId());
        myCourseRepository.save(
                MyCourse.builder()
                        .userId(dto.getUserId())
                        .courseName(dto.getCourseName())
                        .courseData(dto.getCourseData())
                        .build());
    }

    @Transactional(readOnly = true)
    public List<MyCourse> getMyCourses(String userId) {
        return myCourseRepository.findAllByUserId(userId);
    }

    /** 본인 코스만 삭제 가능 (v2.9). 소유자가 토큰 subject 와 다르면 403. */
    @Transactional
    public void deleteCourseAsOwner(Long courseId, String tokenUserId) {
        MyCourse course =
                myCourseRepository
                        .findById(courseId)
                        .orElseThrow(
                                () -> new ResourceNotFoundException("코스를 찾을 수 없습니다: " + courseId));
        if (!tokenUserId.equals(course.getUserId())) {
            throw new SecurityException("본인 코스만 삭제할 수 있습니다.");
        }
        myCourseRepository.delete(course);
    }

    /* ============================== 내부 헬퍼 ============================== */

    private void requireUserExists(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("유저를 찾을 수 없습니다: " + userId);
        }
    }
}
