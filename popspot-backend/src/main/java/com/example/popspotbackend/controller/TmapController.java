package com.example.popspotbackend.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j; // 로그용
import org.springframework.beans.factory.annotation.Value; // 🔥 [추가] 환경변수 주입용
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j // 로그 출력을 위한 어노테이션
@RestController
@RequestMapping("/api/tmap")
@RequiredArgsConstructor
public class TmapController {

    // 🔥 [수정] 하드코딩된 키 제거 -> 환경 변수에서 가져오도록 변경
    // 이제 application.properties의 tmap.app-key=${TMAP_APP_KEY} 값을 사용합니다.
    @Value("${tmap.app-key}")
    private String tmapAppKey;

    @PostMapping("/route")
    public List<Point> getPedestrianRoute(@RequestBody RouteRequestDto request) {

        // 🔥 [디버깅] 서버 콘솔에 현재 사용 중인 키 출력 (실행 시 확인 필수!)
        System.out.println("=========================================");
        System.out.println("👉 [TMAP API 요청] 사용 중인 AppKey: " + tmapAppKey);
        System.out.println("=========================================");

        String url = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json";

        HttpHeaders headers = new HttpHeaders();
        headers.set("appKey", tmapAppKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("startX", request.getStartLng());
        body.put("startY", request.getStartLat());
        body.put("endX", request.getEndLng());
        body.put("endY", request.getEndLat());
        body.put("startName", "Start");
        body.put("endName", "End");
        body.put("reqCoordType", "WGS84GEO");
        body.put("resCoordType", "WGS84GEO");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            Map<String, Object> response = restTemplate.postForObject(url, entity, Map.class);
            return parseRouteCoordinates(response);

        } catch (HttpClientErrorException e) {
            // 🔥 [에러 상세 확인] TMAP이 거절한 진짜 이유를 로그에 출력
            System.err.println("🚨 TMAP API 호출 오류 (HTTP 상태 코드): " + e.getStatusCode());
            System.err.println("🚨 TMAP 응답 본문 (에러 메시지): " + e.getResponseBodyAsString());
            return new ArrayList<>();
        } catch (Exception e) {
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    private List<Point> parseRouteCoordinates(Map<String, Object> response) {
        List<Point> pathPoints = new ArrayList<>();

        if (response == null || !response.containsKey("features")) return pathPoints;

        List<Map<String, Object>> features = (List<Map<String, Object>>) response.get("features");

        for (Map<String, Object> feature : features) {
            Map<String, Object> geometry = (Map<String, Object>) feature.get("geometry");
            String type = (String) geometry.get("type");

            if ("LineString".equals(type)) {
                List<Object> coordinates = (List<Object>) geometry.get("coordinates");
                for (Object coordObj : coordinates) {
                    List<Double> coord = (List<Double>) coordObj;
                    pathPoints.add(new Point(coord.get(1), coord.get(0)));
                }
            }
        }
        return pathPoints;
    }

    @Data
    public static class RouteRequestDto {
        private double startLat;
        private double startLng;
        private double endLat;
        private double endLng;
    }

    @Data
    public static class Point {
        private double lat;
        private double lng;

        public Point(double lat, double lng) {
            this.lat = lat;
            this.lng = lng;
        }
    }
}