package com.example.popspotbackend.config;

import com.example.popspotbackend.repository.GoodsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 굿즈 초기 시드 데이터 주입 자리.
 *
 * <p>현재는 오라클 CSV 원본 데이터를 보존하기 위해 비활성화되어 있다. 신규 환경에서 시드 데이터를 다시 채워야 하면 {@link #initGoodsData} 안에
 * {@code goodsRepository.saveAll(...)} 호출을 복원하면 된다.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class GoodsInitializer {

    @SuppressWarnings("unused")
    private final GoodsRepository goodsRepository;

    @Bean
    public CommandLineRunner initGoodsData() {
        return args -> log.info("[GoodsInitializer] 원본 데이터 보존을 위해 초기화 로직을 건너뜁니다.");
    }
}
