package com.example.popspotbackend;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class PopspotBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(PopspotBackendApplication.class, args);
    }

    /**
     * 서울 팝업 서비스 → KST 고정.
     * GCP VM 기본은 UTC 인 경우가 많으므로 JVM 차원에서 강제.
     * (Jackson 직렬화는 application.properties 의 spring.jackson.time-zone 으로 별도 강제됨)
     */
    @PostConstruct
    void setDefaultTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
    }
}
