package com.example.popspotbackend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import lombok.Data;

/**
 * 팝업 제보 요청 — Mass Assignment 방어용 DTO.
 *
 * <p>사용자가 PopupStore 엔티티 그대로 받으면 id, status, viewCount 등 민감 필드를 클라이언트가 임의로 박아 보내 그대로 저장될 수 있는 취약점이
 * 있다. → 사용자가 보내야 하는 필드만 명시적으로 받는다.
 */
@Data
public class PopupReportRequestDto {

    @NotBlank
    @Size(max = 100)
    private String name;

    @NotBlank
    @Size(max = 200)
    private String location;

    @Size(max = 300)
    private String address;

    @Size(max = 50)
    private String category;

    @Size(max = 1000)
    private String description;

    @Size(max = 1000)
    private String imageUrl;

    /** 관리자가 사실을 확인할 공식 공지·게시물 주소. 서버가 가져오지는 않고 검수 화면에만 보관한다. */
    @Size(max = 1000)
    @Pattern(regexp = "^https?://[^\\s]+$", message = "sourceUrl must use http or https")
    private String sourceUrl;

    @NotBlank
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "startDate must use YYYY-MM-DD")
    private String startDate;

    @NotBlank
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "endDate must use YYYY-MM-DD")
    private String endDate;

    /** 존재하는 날짜이며 시작일이 종료일보다 늦지 않아야 한다. */
    @AssertTrue(message = "startDate and endDate must form a valid date range")
    @JsonIgnore
    public boolean isDateRangeValid() {
        if (startDate == null || endDate == null) {
            return true;
        }
        try {
            LocalDate start = LocalDate.parse(startDate);
            LocalDate end = LocalDate.parse(endDate);
            return !start.isAfter(end);
        } catch (DateTimeParseException ignored) {
            return false;
        }
    }
}
