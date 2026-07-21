package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * 크롤 키워드 순회 커서 — "다음 회차가 어느 키워드부터 시작할지".
 *
 * <p><b>왜 필요한가.</b> 크롤은 키워드 목록을 앞에서부터 순회하는데, 무료 티어의 분당 토큰(TPM 8000)이 한 호출로 거의 소진돼 앞쪽 몇 개 키워드만 처리하고
 * rate limit 으로 멈춘다. 커서가 없으면 <b>다음 회차도 같은 앞부분부터</b> 시작해, 뒤쪽 키워드는 검색만 되고 LLM 해석에는 영영 도달하지 못한다(실제로
 * 390개 중 앞 5개만 반복 처리됐다). 회차마다 커서를 전진시켜 전체 키워드를 며칠에 걸쳐 순회하게 한다.
 *
 * <p><b>단일 행.</b> 커서는 서비스 전체에서 하나뿐이라 {@code id = 1} 고정 행으로 관리한다.
 */
@Entity
@Table(name = "crawl_cursor")
@Getter
@Setter
public class CrawlCursor {

    /** 단일 행 고정 키. 항상 {@link #SINGLETON_ID}. */
    public static final int SINGLETON_ID = 1;

    @Id private Integer id;

    /** 다음 회차가 시작할 키워드 인덱스(0-based). 키워드 수로 나눈 나머지로 순환한다. */
    @Column(name = "keyword_cursor", nullable = false)
    private int keywordCursor;
}
