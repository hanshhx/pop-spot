package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.CourseSaveRequestDto;
import com.example.popspotbackend.entity.MyCourse;
import com.example.popspotbackend.entity.User;
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
 * <p>무료 유저는 슬롯이 1개로 제한되며, 새로 저장하면 기존 코스를 덮어쓴다. 프리미엄 유저는 다중 저장 가능.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MyCourseService {

    private final MyCourseRepository myCourseRepository;
    private final UserRepository userRepository;

    @Transactional
    public void saveCourse(CourseSaveRequestDto dto) {
        User user = findUserOrThrow(dto.getUserId());
        if (!user.isPremium()) {
            evictExistingCoursesForFreeUser(dto.getUserId());
        }
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

    /**
     * 본인 코스만 삭제 가능 (v2.9 보안). 코스 소유자가 토큰 subject 와 다르면
     * {@link SecurityException} → 403.
     */
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

    private User findUserOrThrow(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("유저를 찾을 수 없습니다: " + userId));
    }

    private void evictExistingCoursesForFreeUser(String userId) {
        List<MyCourse> existing = myCourseRepository.findAllByUserId(userId);
        if (existing.isEmpty()) return;
        myCourseRepository.deleteAll(existing);
        log.info("[MyCourse] 무료 유저 {} 의 기존 코스를 덮어쓰기 위해 삭제", userId);
    }
}
