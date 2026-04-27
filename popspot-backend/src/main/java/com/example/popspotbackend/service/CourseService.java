package com.example.popspotbackend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class CourseService {

    public List<Map<String, Object>> recommendCourse(String vibe) {
        // 입력받은 Vibe에 따라 다른 코스를 줍니다.
        // 프론트엔드 InteractiveMap과 호환되도록 id, name, lat, lng, category, reason을 꼭 넣습니다.

        List<Map<String, Object>> course = new ArrayList<>();

        if (vibe.contains("데이트") || vibe.contains("로맨틱")) {
            course.add(createPlace(101, "서울숲 거울연못", 37.5436, 127.0447, "공원", "로맨틱한 산책의 시작"));
            course.add(createPlace(102, "성수 디올", 37.5443, 127.0518, "쇼핑", "화려한 외관 앞에서 커플 사진"));
            course.add(createPlace(103, "포인트 오브 뷰", 37.5451, 127.0532, "소품샵", "아기자기한 커플 아이템 구경"));
            course.add(createPlace(104, "소문난성수감자탕", 37.5412, 127.0544, "맛집", "데이트의 마무리는 든든하게"));
        } else if (vibe.contains("사진") || vibe.contains("인생샷")) {
            course.add(createPlace(201, "아더 성수 스페이스", 37.5445, 127.0560, "전시", "우주 컨셉의 힙한 포토존"));
            course.add(createPlace(202, "탬버린즈 성수", 37.5430, 127.0580, "쇼핑", "감각적인 인테리어와 향기"));
            course.add(createPlace(203, "LCDC SEOUL", 37.5401, 127.0589, "복합문화", "곳곳이 포토존인 핫플레이스"));
        } else if (vibe.contains("힐링") || vibe.contains("여유")) {
            course.add(createPlace(301, "블루보틀 성수", 37.5480, 127.0450, "카페", "조용한 커피 한 잔의 여유"));
            course.add(createPlace(302, "서울숲 가족마당", 37.5440, 127.0390, "공원", "돗자리 펴고 힐링 피크닉"));
            course.add(createPlace(303, "모나미 성수", 37.5415, 127.0565, "카페", "심플한 공간에서의 휴식"));
        } else {
            // 기본값 (핫플 정복)
            course.add(createPlace(401, "성수역 3번출구", 37.5445, 127.0560, "출발", "투어의 시작점"));
            course.add(createPlace(402, "대림창고", 37.5412, 127.0544, "카페", "성수동의 상징적인 갤러리 카페"));
            course.add(createPlace(403, "피치스 도원", 37.5460, 127.0570, "복합문화", "자동차와 도넛의 힙한 만남"));
            course.add(createPlace(404, "성수 연방", 37.5420, 127.0540, "복합문화", "다양한 샵이 모인 문화 공간"));
        }

        return course;
    }

    // 헬퍼 메소드 (데이터 생성용)
    private Map<String, Object> createPlace(long id, String name, double lat, double lng, String category, String reason) {
        Map<String, Object> place = new HashMap<>();
        place.put("id", id);
        place.put("name", name);
        place.put("lat", lat);
        place.put("lng", lng);
        place.put("category", category);
        place.put("reason", reason);
        return place;
    }
}