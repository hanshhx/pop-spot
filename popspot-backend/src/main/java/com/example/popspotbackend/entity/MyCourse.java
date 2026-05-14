package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 사용자가 저장한 코스 (장소 목록 + 메모).
 *
 * <p>{@code courseData} 는 프론트가 직렬화한 JSON 을 그대로 받기 위해 PostgreSQL TEXT 로 보관한다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "MY_COURSE")
public class MyCourse {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "my_course_generator")
    @SequenceGenerator(
            name = "my_course_generator",
            sequenceName = "my_course_seq",
            allocationSize = 1)
    @Column(name = "COURSE_ID")
    private Long id;

    @Column(name = "USER_ID")
    private String userId;

    @Column(name = "COURSE_NAME")
    private String courseName;

    @Column(name = "COURSE_DATA", columnDefinition = "TEXT")
    private String courseData;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
