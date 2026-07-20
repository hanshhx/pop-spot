package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.CrawlSourceLedger;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CrawlSourceLedgerRepository extends JpaRepository<CrawlSourceLedger, Long> {

    /**
     * 이미 알고 있는 URL 들을 한 번에 조회한다.
     *
     * <p>키워드당 스니펫이 수십 개라 건별 조회는 N+1 이 된다. IN 절로 한 번에 가져와 메모리에서 대조한다.
     */
    List<CrawlSourceLedger> findBySourceUrlHashIn(List<String> sourceUrlHashes);

    /** 검색 결과에 다시 등장한 글의 관측 시각만 갱신. 재처리 대상이 아니어도 "살아 있음" 은 기록한다. */
    @Modifying
    @Query("UPDATE CrawlSourceLedger l SET l.lastSeenAt = :now WHERE l.sourceUrlHash IN :hashes")
    int touchLastSeen(
            @Param("hashes") List<String> sourceUrlHashes, @Param("now") LocalDateTime now);

    /** 오래 안 보인 항목 정리 — 대장이 무한정 자라지 않게. */
    @Modifying
    @Query("DELETE FROM CrawlSourceLedger l WHERE l.lastSeenAt < :cutoff")
    int deleteStale(@Param("cutoff") LocalDateTime cutoff);

    /**
     * 처리 결과 기록 — 있으면 갱신, 없으면 삽입.
     *
     * <p>SELECT 후 없으면 INSERT 하는 방식은 check-then-act 라 동시 실행에서 유니크 위반이 난다. 크롤은 크론(04·16시)과 어드민 수동 실행
     * 두 경로가 있고 중복 실행 가드가 없어, 1회가 수십 분인 만큼 겹칠 창이 충분하다. 크롤 루프는 의도적으로 트랜잭션 밖이라 예외가 나면 남은 키워드가 통째로
     * 날아간다.
     */
    @Modifying
    @Query(
            value =
                    "INSERT INTO crawl_source_ledger (source_url_hash, content_hash, source_name,"
                            + " status, model_name, last_seen_at, last_processed_at)"
                            + " VALUES (:urlHash, :contentHash, :sourceName, :status, :modelName,"
                            + " :now, :now)"
                            + " ON CONFLICT (source_url_hash) DO UPDATE SET"
                            + " content_hash = EXCLUDED.content_hash,"
                            + " status = EXCLUDED.status,"
                            + " model_name = EXCLUDED.model_name,"
                            + " last_seen_at = EXCLUDED.last_seen_at,"
                            + " last_processed_at = EXCLUDED.last_processed_at",
            nativeQuery = true)
    void upsert(
            @Param("urlHash") String urlHash,
            @Param("contentHash") String contentHash,
            @Param("sourceName") String sourceName,
            @Param("status") String status,
            @Param("modelName") String modelName,
            @Param("now") LocalDateTime now);
}
