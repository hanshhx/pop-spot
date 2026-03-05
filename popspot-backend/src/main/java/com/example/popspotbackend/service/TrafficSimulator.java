package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class TrafficSimulator {

    private final PopupStoreRepository popupStoreRepository;
    private final Random random = new Random();

    // [로직 해석] 3초(3000ms)마다 이 코드가 자동으로 실행됩니다.
    @Scheduled(fixedRate = 3000)
    public void simulateTraffic() {
        List<PopupStore> stores = popupStoreRepository.findAll();

        if (stores.isEmpty()) return;

        // [로직] 랜덤으로 3개의 가게를 뽑아서 조회수를 랜덤하게(1~10) 올립니다.
        for (int i = 0; i < 3; i++) {
            PopupStore randomStore = stores.get(random.nextInt(stores.size()));

            // 기존 조회수에 1~10 사이 랜덤 숫자 더하기
            int randomIncrease = random.nextInt(10) + 1;
            randomStore.setViewCount(randomStore.getViewCount() + randomIncrease);

            // 변경사항 저장
            popupStoreRepository.save(randomStore);

            System.out.println("🤖 [AI 시뮬레이터] " + randomStore.getName() + " 조회수 증가! (+" + randomIncrease + ")");
        }
    }
}