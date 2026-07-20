package com.example.popspotbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 크롤 처리 이력 — 같은 글을 다시 LLM 에 넣지 않기 위한 대장.
 *
 * <p>검색 API 는 같은 블로그 글을 여러 키워드 결과에 실어 주고, 하루 두 번 돌면 어제 본 글도 다시 나온다. 그때마다 LLM 을 호출해 왔는데 무료 티어의 병목이
 * 일일 토큰이라 이것이 가장 큰 낭비였다. URL 로 먼저 걸러 <b>새로 올라왔거나 내용이 바뀐 글</b>만 넘긴다.
 *
 * <p>URL 해시와 내용 해시를 나눠 두는 이유: 주소가 같아도 글이 수정되면(기간 연장·장소 변경) 다시 해석해야 한다.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "crawl_source_ledger",
        indexes = {@Index(name = "idx_crawl_ledger_seen", columnList = "last_seen_at")})
public class CrawlSourceLedger {

    /** 처리 상태. */
    public static final String STATUS_NEW = "NEW";

    /** LLM 해석까지 끝난 글. 내용이 바뀌지 않는 한 다시 보내지 않는다. */
    public static final String STATUS_PROCESSED = "PROCESSED";

    /** 해석했지만 팝업이 아니거나 신뢰도 미달로 버린 글. 다시 보낼 이유가 없다. */
    public static final String STATUS_REJECTED = "REJECTED";

    /** 호출 자체가 실패한 글. 다음 회차에 다시 시도한다. */
    public static final String STATUS_RETRYABLE = "RETRYABLE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 정규화된 URL 의 SHA-256(hex 64자). DB 에 유니크 인덱스가 걸려 있다. */
    @Column(name = "source_url_hash", nullable = false, length = 64)
    private String sourceUrlHash;

    /** 제목+요약의 SHA-256. 값이 바뀌면 글이 수정된 것으로 보고 다시 처리한다. */
    @Column(name = "content_hash", length = 64)
    private String contentHash;

    /** 어느 채널에서 온 글인지(네이버 블로그/뉴스, 카카오 웹/블로그). 통계용. */
    @Column(name = "source_name", length = 50)
    private String sourceName;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    /** 해석에 쓴 모델. 모델을 바꾼 뒤 재처리 여부를 판단할 근거가 된다. */
    @Column(name = "model_name", length = 100)
    private String modelName;

    /** 검색 결과에 마지막으로 등장한 시각. 오래된 항목 정리 기준. */
    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    /** LLM 처리를 마친 시각. */
    @Column(name = "last_processed_at")
    private LocalDateTime lastProcessedAt;
}
