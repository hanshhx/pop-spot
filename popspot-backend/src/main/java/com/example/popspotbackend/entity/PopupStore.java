package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "popup_store")
public class PopupStore {

    @Id
    // 🚨 [핵심 로직] PostgreSQL의 시퀀스 기능을 사용하여 ID 자동 생성
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "popup_store_generator")
    @SequenceGenerator(
            name = "popup_store_generator",
            sequenceName = "popup_store_seq", // DB에 만든 시퀀스 이름과 일치해야 함
            allocationSize = 1                // 1씩 증가
    )
    @Column(name = "popup_id")
    private Long id;

    @Column(name = "api_popup_id")
    private String apiPopupId;

    @Column(name = "partner_id")
    private String partnerId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "address")
    private String location;

    @Column(name = "detail_address")
    private String address;

    @Column(name = "content", length = 2000)
    private String content;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "category")
    private String category;

    @Column(name = "start_date")
    private String startDate;

    @Column(name = "end_date")
    private String endDate;

    @Column(name = "is_active")
    private String isActive;

    @Column(name = "view_count", columnDefinition = "integer default 0")
    @Builder.Default
    private Integer viewCount = 0;

    @Column(name = "latitude")
    private String latitude;

    @Column(name = "longitude")
    private String longitude;

    @Column(name = "status")
    private String status;

    @Column(name = "reporter_id")
    private String reporterId;

    @Builder.Default
    @OneToMany(fetch = FetchType.EAGER)
    @JoinColumn(name = "popup_id")
    private List<PopupImage> images = new ArrayList<>();

    public String getImageUrl() {
        if (images != null && !images.isEmpty()) {
            return images.stream()
                    .filter(img -> "Y".equals(img.getMainYn()))
                    .findFirst()
                    .map(PopupImage::getImageUrl)
                    .orElse(images.get(0).getImageUrl());
        }
        return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2070&auto=format&fit=crop";
    }

    public void updateAllDetails(Map<String, String> data) {
        if (data == null) return;
        if (data.get("popup_id") != null) this.apiPopupId = data.get("popup_id");
        if (data.get("partner_id") != null) this.partnerId = data.get("partner_id");
        if (data.get("name") != null) this.name = data.get("name");
        if (data.get("content") != null) this.content = data.get("content");
        if (data.get("description") != null) this.description = data.get("description");
        if (data.get("category") != null) this.category = data.get("category");
        if (data.get("start_date") != null) this.startDate = data.get("start_date");
        if (data.get("end_date") != null) this.endDate = data.get("end_date");
        if (data.get("location") != null) this.location = data.get("location");
        if (data.get("latitude") != null) this.latitude = data.get("latitude");
        if (data.get("longitude") != null) this.longitude = data.get("longitude");
        if (data.get("is_active") != null) this.isActive = data.get("is_active");
        if (data.get("status") != null) this.status = data.get("status");
        if (data.get("views") != null) {
            try {
                this.viewCount = Integer.parseInt(data.get("views"));
            } catch (NumberFormatException e) {}
        }
    }

    public void updateDetails(String description, String startDate, String endDate) {
        this.description = description;
        this.startDate = startDate;
        this.endDate = endDate;
    }
}