package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.MyCourse;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

/**
 * 내 코스 조회 응답 DTO.
 *
 * <p>JPA 엔티티를 그대로 직렬화하면 LAZY 필드 / 내부 컬럼명 노출 위험이 있어 API 경계용 DTO 로 한 번
 * 감싼다. 프론트는 기존과 동일한 필드명을 받는다 ({@code id}, {@code userId}, {@code courseName},
 * {@code courseData}, {@code createdAt}).
 */
@Getter
@Builder
public class MyCourseResponseDto {

    private final Long id;
    private final String userId;
    private final String courseName;
    private final String courseData;
    private final LocalDateTime createdAt;

    public static MyCourseResponseDto fromEntity(MyCourse entity) {
        return MyCourseResponseDto.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .courseName(entity.getCourseName())
                .courseData(entity.getCourseData())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
