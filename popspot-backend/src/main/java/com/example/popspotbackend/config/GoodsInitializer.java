package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.repository.GoodsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class GoodsInitializer {

    private final GoodsRepository goodsRepository;

    @Bean
    public CommandLineRunner initGoodsData() {
        return args -> {
            // [수정] 오라클 CSV 원본 데이터 보존을 위해 삭제 및 초기화 로직을 모두 주석 처리합니다.

            // 기존 데이터 초기화 (물건 데이터 삭제)
            // goodsRepository.deleteAll();
            // System.out.println("🧹 기존 굿즈 데이터 삭제 완료 -> 디지털 아이템 생성 시작");

            // [디지털 아이템 2종 정의]
            // 1. POP-PASS (멤버십)
            /* Goods popPass = Goods.builder()
                    .name("👑 POP-PASS (프리미엄 멤버십)")
                    .price(4900)
                    // 이미지는 추후 로컬 파일이나 CDN으로 교체 가능, 현재는 예시 URL
                    .imageUrl("https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?q=80&w=800&auto=format&fit=crop")
                    .description("성수동 완전 정복! AI 코스 무제한 저장 + 리뷰 꿀팁 잠금 해제")
                    .build();

            // 2. 확성기 (소모성 아이템)
            Goods megaphone = Goods.builder()
                    .name("📢 메이트 확성기 (1회권)")
                    .price(500)
                    .imageUrl("https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?q=80&w=800&auto=format&fit=crop")
                    .description("내 동행 구하기 글을 상단에 고정하여 매칭 확률 UP!")
                    .build();

            List<Goods> items = Arrays.asList(popPass, megaphone);
            goodsRepository.saveAll(items);

            System.out.println("🎉 디지털 아이템(POP-PASS, 확성기) 생성 완료!"); */

            // [추가] 서버 기동 시 로직이 무력화되었음을 확인하기 위한 로그
            System.out.println("🛡️ 원본 데이터 보존을 위해 GoodsInitializer 초기화 로직을 건너뜁니다.");
        };
    }
}