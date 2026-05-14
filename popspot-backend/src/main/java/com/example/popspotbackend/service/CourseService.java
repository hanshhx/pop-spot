package com.example.popspotbackend.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * vibe 키워드에 맞춰 미리 정의된 성수동 코스를 돌려주는 정적 추천 서비스.
 *
 * <p>프론트 InteractiveMap 과 호환되도록 각 장소 Map 에 {@code id / name / lat / lng / category / reason} 키를 항상
 * 포함시킨다.
 */
@Slf4j
@Service
public class CourseService {

    private static final String KEYWORD_DATE = "데이트";
    private static final String KEYWORD_ROMANTIC = "로맨틱";
    private static final String KEYWORD_PHOTO = "사진";
    private static final String KEYWORD_INSTA = "인생샷";
    private static final String KEYWORD_HEALING = "힐링";
    private static final String KEYWORD_CHILL = "여유";

    public List<Map<String, Object>> recommendCourse(String vibe) {
        if (containsAny(vibe, KEYWORD_DATE, KEYWORD_ROMANTIC)) return datingCourse();
        if (containsAny(vibe, KEYWORD_PHOTO, KEYWORD_INSTA)) return photoCourse();
        if (containsAny(vibe, KEYWORD_HEALING, KEYWORD_CHILL)) return healingCourse();
        return defaultHotPlaceCourse();
    }

    /* ============================== 코스 정의 ============================== */

    private List<Map<String, Object>> datingCourse() {
        List<Map<String, Object>> course = new ArrayList<>();
        course.add(place(101, "서울숲 거울연못", 37.5436, 127.0447, "공원", "로맨틱한 산책의 시작"));
        course.add(place(102, "성수 디올", 37.5443, 127.0518, "쇼핑", "화려한 외관 앞에서 커플 사진"));
        course.add(place(103, "포인트 오브 뷰", 37.5451, 127.0532, "소품샵", "아기자기한 커플 아이템 구경"));
        course.add(place(104, "소문난성수감자탕", 37.5412, 127.0544, "맛집", "데이트의 마무리는 든든하게"));
        return course;
    }

    private List<Map<String, Object>> photoCourse() {
        List<Map<String, Object>> course = new ArrayList<>();
        course.add(place(201, "아더 성수 스페이스", 37.5445, 127.0560, "전시", "우주 컨셉의 힙한 포토존"));
        course.add(place(202, "탬버린즈 성수", 37.5430, 127.0580, "쇼핑", "감각적인 인테리어와 향기"));
        course.add(place(203, "LCDC SEOUL", 37.5401, 127.0589, "복합문화", "곳곳이 포토존인 핫플레이스"));
        return course;
    }

    private List<Map<String, Object>> healingCourse() {
        List<Map<String, Object>> course = new ArrayList<>();
        course.add(place(301, "블루보틀 성수", 37.5480, 127.0450, "카페", "조용한 커피 한 잔의 여유"));
        course.add(place(302, "서울숲 가족마당", 37.5440, 127.0390, "공원", "돗자리 펴고 힐링 피크닉"));
        course.add(place(303, "모나미 성수", 37.5415, 127.0565, "카페", "심플한 공간에서의 휴식"));
        return course;
    }

    private List<Map<String, Object>> defaultHotPlaceCourse() {
        List<Map<String, Object>> course = new ArrayList<>();
        course.add(place(401, "성수역 3번출구", 37.5445, 127.0560, "출발", "투어의 시작점"));
        course.add(place(402, "대림창고", 37.5412, 127.0544, "카페", "성수동의 상징적인 갤러리 카페"));
        course.add(place(403, "피치스 도원", 37.5460, 127.0570, "복합문화", "자동차와 도넛의 힙한 만남"));
        course.add(place(404, "성수 연방", 37.5420, 127.0540, "복합문화", "다양한 샵이 모인 문화 공간"));
        return course;
    }

    /* ============================== 내부 헬퍼 ============================== */

    private boolean containsAny(String text, String... keywords) {
        if (text == null) return false;
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        return false;
    }

    private Map<String, Object> place(
            long id, String name, double lat, double lng, String category, String reason) {
        Map<String, Object> p = new HashMap<>();
        p.put("id", id);
        p.put("name", name);
        p.put("lat", lat);
        p.put("lng", lng);
        p.put("category", category);
        p.put("reason", reason);
        return p;
    }
}
