package com.example.popspotbackend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * [로직 구조 해석]
 * 1. @Entity: 이 클래스가 데이터베이스의 테이블과 매핑되는 객체임을 선언합니다.
 * 2. @Table: 테이블 이름을 'STAMP'로 지정합니다.
 * (기존의 uniqueConstraints = {@UniqueConstraint...} 부분은 삭제하여
 * 동일 유저가 동일 팝업에 날짜만 다르면 여러 번 스탬프를 찍을 수 있게 변경했습니다.)
 */
@Entity
// 🔒 [Race Condition 방어] 동일 유저 + 동일 팝업 중복 방지를 DB 차원에서 확정.
//    동시성 두 요청이 둘 다 existsBy 통과 → 두 INSERT 시도 시, 두 번째가 unique violation 으로 실패.
//    (하루 1회 정책은 컨트롤러 레벨에서 검사 + 이 제약은 평생 중복만 차단 — 동일 유저+팝업 조합은 DB가 막음)
@Table(
    name = "STAMP",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_stamp_user_popup", columnNames = {"USER_ID", "POPUP_ID"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Stamp {

    /**
     * [로직 해석]
     * @Id: 기본키(PK)를 지정합니다.
     * @GeneratedValue: Oracle Sequence 제거 -> MySQL/PostgreSQL Identity 사용
     */
    @Id
    // @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "seq_stamp")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "STAMP_ID")
    private Long id;

    /**
     * [코드 해석]
     * DB 규격에 맞춰 String 타입의 USER_ID 컬럼과 매핑합니다.
     */
    @Column(name = "USER_ID", nullable = false)
    private String userId;

    /**
     * [로직 해석]
     * @ManyToOne: 여러 개의 스탬프가 하나의 팝업 스토어에 속할 수 있는 관계를 정의합니다.
     * @JoinColumn: 외래키(FK)인 POPUP_ID 컬럼을 통해 PopupStore 엔티티와 연결합니다.
     */
    // 🔥 [임의 수정] 스탬프 조회 시 매번 불필요하게 팝업 정보를 가져오던 EAGER를 LAZY로 변경합니다.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "POPUP_ID", nullable = false)
    private PopupStore popupStore;

    /**
     * [코드 해석]
     * DB의 STAMP_DATE 컬럼과 매핑됩니다.
     */
    @Column(name = "STAMP_DATE")
    private LocalDateTime stampDate;

    /**
     * [로직 구조 해석]
     * @PrePersist: 엔티티가 데이터베이스에 INSERT 되기 직전에 실행되는 콜백 메서드입니다.
     * 별도로 날짜를 세팅하지 않아도 자동으로 현재 서버 시간이 stampDate 필드에 할당되어 DB에 저장됩니다.
     */
    @PrePersist
    public void prePersist() {
        this.stampDate = LocalDateTime.now();
    }
}