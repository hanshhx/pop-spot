package com.example.popspotbackend.dto;
import lombok.Data;

@Data
public class CourseSaveRequestDto {
    private String userId;
    private String courseName;
    private String courseData;
}