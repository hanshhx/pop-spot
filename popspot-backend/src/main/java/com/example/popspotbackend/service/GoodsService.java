package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.Goods;
import com.example.popspotbackend.repository.GoodsRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 굿즈 조회 도메인 서비스.
 *
 * <p>팝업별 굿즈 목록과 메인 화면용 랜덤 픽업을 제공한다. 셔플은 메모리에서 처리하므로 굿즈 카탈로그가 수천 행을 넘으면 DB {@code ORDER BY RANDOM}
 * 으로 옮길 것.
 */
@Service
@RequiredArgsConstructor
public class GoodsService {

    private static final int RANDOM_PICK_LIMIT = 20;

    private final GoodsRepository goodsRepository;

    @Transactional(readOnly = true)
    public List<Goods> findByPopup(Long popupId) {
        return goodsRepository.findByPopupStore_Id(popupId);
    }

    /** 메인 화면용 랜덤 굿즈. 데이터가 부족하면 그대로 전부 반환한다. */
    @Transactional(readOnly = true)
    public List<Goods> findRandomPicks() {
        List<Goods> shuffled = new ArrayList<>(goodsRepository.findAll());
        Collections.shuffle(shuffled);
        return shuffled.subList(0, Math.min(shuffled.size(), RANDOM_PICK_LIMIT));
    }
}
