package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// 🔥 [긴급 수정] 다시 <User, String>으로 복구합니다!
public interface UserRepository extends JpaRepository<User, String> {

    /**
     * 이 사용자의 발급된 토큰을 <b>전부 무효화</b>한다.
     *
     * <p>JWT 에는 발급 시점의 {@code tokenVersion} 이 {@code ver} 클레임으로 박혀 있고, 매 요청마다 DB 값과
     * 대조한다(JwtAuthenticationFilter · WebSocketConfig). 이 값을 올리면 이전에 발급된 토큰은 전부 어긋나 거부된다.
     *
     * <p><b>읽고 더해서 쓰지 않고 DB 에서 직접 올린다.</b> 두 곳에서 동시에 무효화하면 읽기-쓰기 방식은 한 번만 오르고 한쪽이 덮어써진다 — 보안 조치가
     * 조용히 절반만 먹는다.
     *
     * @return 실제로 바뀐 행 수(0 이면 그런 사용자가 없다)
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.tokenVersion = u.tokenVersion + 1 WHERE u.userId = :userId")
    int bumpTokenVersion(@Param("userId") String userId);

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    // Auth 서비스에서 필요한 메서드 복구
    Optional<User> findByPhoneNumber(String phoneNumber);

    Optional<User> findByNicknameAndPhoneNumber(String nickname, String phoneNumber);

    // 🔥 [신규 추가] 관리자가 닉네임으로 유저를 찾아 보상을 지급하기 위한 메서드
    Optional<User> findByNickname(String nickname);

    /** v2.27 — 관리자 회원 목록: 가입 최신순. */
    List<User> findAllByOrderByCreatedAtDesc();
}
