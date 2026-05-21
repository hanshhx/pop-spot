package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.MyCourse;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

/**
 * 내 코스 조회 응답 DTO.
 *
 * <p>JPA 엔티티 직접 직렬화의 LAZY / 내부 컬럼 노출 위험을 API 경계에서 차단. 프론트 필드명은 유지.
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
