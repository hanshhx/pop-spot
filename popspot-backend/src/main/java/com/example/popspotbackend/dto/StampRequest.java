package com.example.popspotbackend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StampRequest {
    private String userId;
    private Long popupId;
}