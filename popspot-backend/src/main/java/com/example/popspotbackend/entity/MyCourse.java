package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "MY_COURSE")
public class MyCourse {

    @Id
    // 🚨 [에러 완전 해결]
    // 1. generator 이름을 "my_course_generator"로 명시
    // 2. sequenceName을 아까 DB에서 만든 "my_course_seq"와 정확히 일치시킴
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "my_course_generator")
    @SequenceGenerator(
            name = "my_course_generator",
            sequenceName = "my_course_seq",
            allocationSize = 1
    )
    @Column(name = "COURSE_ID")
    private Long id;

    @Column(name = "USER_ID")
    private String userId;

    @Column(name = "COURSE_NAME")
    private String courseName;

    // PostgreSQL에서 긴 텍스트를 저장하기 위해 TEXT 타입 지정
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