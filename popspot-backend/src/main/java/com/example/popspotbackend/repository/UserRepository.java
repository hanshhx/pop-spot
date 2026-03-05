package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

// 🔥 [긴급 수정] 다시 <User, String>으로 복구합니다!
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByNickname(String nickname);

    // Auth 서비스에서 필요한 메서드 복구
    Optional<User> findByPhoneNumber(String phoneNumber);
    Optional<User> findByNicknameAndPhoneNumber(String nickname, String phoneNumber);

    // 🔥 [신규 추가] 관리자가 닉네임으로 유저를 찾아 보상을 지급하기 위한 메서드
    Optional<User> findByNickname(String nickname);
}