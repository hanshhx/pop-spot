package com.example.popspotbackend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class PopupReportRequestDtoValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsHttpEvidenceLinkAndRejectsExecutableScheme() {
        PopupReportRequestDto request = validRequest();
        request.setSourceUrl("https://official.example.com/notice/1");
        assertThat(validator.validate(request)).isEmpty();

        request.setSourceUrl("javascript:alert(1)");
        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("sourceUrl"));
    }

    @Test
    void sourceLinkRemainsOptional() {
        assertThat(validator.validate(validRequest())).isEmpty();
    }

    @Test
    void rejectsImpossibleOrReversedDateRange() {
        PopupReportRequestDto request = validRequest();
        request.setStartDate("2026-02-30");
        assertThat(validator.validate(request))
                .anyMatch(
                        violation ->
                                violation.getPropertyPath().toString().equals("dateRangeValid"));

        request.setStartDate("2026-09-01");
        request.setEndDate("2026-08-31");
        assertThat(validator.validate(request))
                .anyMatch(
                        violation ->
                                violation.getPropertyPath().toString().equals("dateRangeValid"));
    }

    private PopupReportRequestDto validRequest() {
        PopupReportRequestDto request = new PopupReportRequestDto();
        request.setName("테스트 팝업");
        request.setLocation("서울 성동구");
        request.setStartDate("2026-08-14");
        request.setEndDate("2026-08-31");
        return request;
    }
}
