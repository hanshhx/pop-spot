package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // ================= [기존 코드 유지] =================

    @Transactional
    public String signup(SignupRequestDto requestDto) {
        if (userRepository.existsByEmail(requestDto.getEmail())) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }

        User user = User.builder()
                .email(requestDto.getEmail())
                .password(passwordEncoder.encode(requestDto.getPassword()))
                .nickname(requestDto.getNickname())
                .phoneNumber(requestDto.getPhoneNumber())
                .role("USER")
                .provider("LOCAL")
                .build();

        return userRepository.save(user).getUserId();
    }

    @Transactional(readOnly = true)
    public String findEmailByPhoneNumber(String phoneNumber) {
        User user = userRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new RuntimeException("해당 번호로 가입된 유저가 없습니다."));

        return user.getEmail();
    }

    @Transactional
    public void updatePassword(String email, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("해당 이메일의 유저가 없습니다."));

        String encodedPassword = passwordEncoder.encode(newPassword);
        user.changePassword(encodedPassword);
    }

    @Transactional(readOnly = true)
    public com.example.popspotbackend.dto.LoginResponseDto login(com.example.popspotbackend.dto.LoginRequestDto requestDto) {
        User user = userRepository.findByEmail(requestDto.getEmail())
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));

        if (!passwordEncoder.matches(requestDto.getPassword(), user.getPassword())) {
            throw new RuntimeException("비밀번호가 일치하지 않습니다.");
        }

        return com.example.popspotbackend.dto.LoginResponseDto.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .role(user.getRole())
                .isPremium(user.isPremium())
                .megaphoneCount(user.getMegaphoneCount())
                .token("TEMP_TOKEN_" + user.getUserId())
                .build();
    }

    // 이메일 존재 여부 확인
    @Transactional(readOnly = true)
    public boolean checkEmailExists(String email) {
        return userRepository.existsByEmail(email);
    }

    // ================= [🔥 새로 추가된 메서드] =================

    /**
     * [추가 1] 아이디 찾기 (이름 + 전화번호)
     * 반환값: 이메일뿐만 아니라 가입 경로(provider)도 같이 반환하여 프론트에서 소셜 여부를 알려줌
     */
    @Transactional(readOnly = true)
    public Map<String, String> findEmailByNameAndPhone(String nickname, String phoneNumber) {
        // UserRepository에 findByNicknameAndPhoneNumber 메서드가 필요합니다.
        User user = userRepository.findByNicknameAndPhoneNumber(nickname, phoneNumber)
                .orElseThrow(() -> new RuntimeException("일치하는 회원 정보가 없습니다."));

        Map<String, String> result = new HashMap<>();
        result.put("email", user.getEmail());
        // provider가 null이면 "LOCAL"로 간주
        result.put("provider", user.getProvider() == null ? "LOCAL" : user.getProvider());

        return result;
    }

    /**
     * [추가 2] 비밀번호 찾기 전 검증 (이메일 + 이름 + 소셜 여부 체크)
     * 소셜 로그인 유저라면 비밀번호 변경을 막기 위해 에러를 발생시킵니다.
     */
    @Transactional(readOnly = true)
    public void checkUserForPasswordReset(String email, String nickname) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("가입된 이메일이 아닙니다."));

        // 이름 일치 확인
        if (!user.getNickname().equals(nickname)) {
            throw new RuntimeException("이름이 일치하지 않습니다.");
        }

        // 🔥 소셜 로그인 유저 차단 로직
        String provider = user.getProvider();
        if (provider != null && !provider.equals("LOCAL") && !provider.equals("null")) {
            // 컨트롤러에서 잡아서 프론트에 알려줄 수 있도록 특수 메시지 전송
            throw new RuntimeException("SOCIAL_USER:" + provider);
        }
    }
}