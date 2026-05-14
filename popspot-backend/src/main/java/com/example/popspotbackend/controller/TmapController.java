package com.example.popspotbackend.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/** TMAP 보행자 경로 API 프록시. AppKey 는 환경변수 {@code TMAP_APP_KEY} 로 주입된다. */
@Slf4j
@RestController
@RequestMapping("/api/tmap")
@RequiredArgsConstructor
public class TmapController {

    private static final String PEDESTRIAN_ROUTE_URL =
            "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json";
    private static final String COORD_TYPE_WGS84 = "WGS84GEO";
    private static final String GEOMETRY_TYPE_LINE_STRING = "LineString";

    @Value("${tmap.app-key}")
    private String tmapAppKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/route")
    public List<Point> getPedestrianRoute(@RequestBody RouteRequestDto request) {
        try {
            HttpEntity<Map<String, Object>> entity =
                    new HttpEntity<>(buildRouteBody(request), buildHeaders());
            @SuppressWarnings("unchecked")
            Map<String, Object> response =
                    restTemplate.postForObject(PEDESTRIAN_ROUTE_URL, entity, Map.class);
            return parseRouteCoordinates(response);
        } catch (HttpClientErrorException e) {
            log.warn(
                    "[Tmap] API 거절 status={} body={}",
                    e.getStatusCode(),
                    e.getResponseBodyAsString());
            return List.of();
        } catch (Exception e) {
            log.error("[Tmap] 경로 조회 실패", e);
            return List.of();
        }
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("appKey", tmapAppKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private Map<String, Object> buildRouteBody(RouteRequestDto request) {
        Map<String, Object> body = new HashMap<>();
        body.put("startX", request.getStartLng());
        body.put("startY", request.getStartLat());
        body.put("endX", request.getEndLng());
        body.put("endY", request.getEndLat());
        body.put("startName", "Start");
        body.put("endName", "End");
        body.put("reqCoordType", COORD_TYPE_WGS84);
        body.put("resCoordType", COORD_TYPE_WGS84);
        return body;
    }

    @SuppressWarnings("unchecked")
    private List<Point> parseRouteCoordinates(Map<String, Object> response) {
        if (response == null || !response.containsKey("features")) {
            return new ArrayList<>();
        }
        List<Point> pathPoints = new ArrayList<>();
        List<Map<String, Object>> features = (List<Map<String, Object>>) response.get("features");

        for (Map<String, Object> feature : features) {
            Map<String, Object> geometry = (Map<String, Object>) feature.get("geometry");
            if (!GEOMETRY_TYPE_LINE_STRING.equals(geometry.get("type"))) continue;
            List<Object> coordinates = (List<Object>) geometry.get("coordinates");
            for (Object coordObj : coordinates) {
                List<Double> coord = (List<Double>) coordObj;
                pathPoints.add(new Point(coord.get(1), coord.get(0)));
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
