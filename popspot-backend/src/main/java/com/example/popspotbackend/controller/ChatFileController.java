package com.example.popspotbackend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "http://localhost:3000")
public class ChatFileController {

    // 🔥 [핵심] 프로젝트 루트 경로 아래 'uploads' 폴더를 자동으로 잡습니다. (배포 시 유리)
    private final String UPLOAD_DIR = Paths.get(System.getProperty("user.dir"), "uploads").toString();

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) return ResponseEntity.badRequest().body("파일이 없습니다.");

        try {
            // 1. 저장할 디렉토리가 없으면 생성
            File directory = new File(UPLOAD_DIR);
            if (!directory.exists()) {
                directory.mkdirs();
            }

            // 2. 파일명 생성 (중복 방지용 UUID + 원본파일명)
            String originalFileName = file.getOriginalFilename();
            String savedFileName = UUID.randomUUID().toString() + "_" + originalFileName;
            File dest = new File(UPLOAD_DIR + File.separator + savedFileName);

            // 3. 파일 물리적 저장
            file.transferTo(dest);

            // 4. 클라이언트가 접근할 URL 생성
            // 배포 시에는 도메인 주소로 변경될 수 있게 상대 경로형태로 반환하거나 설정파일에서 가져옴
            String fileUrl = "http://localhost:8080/uploads/" + savedFileName;

            Map<String, String> response = new HashMap<>();
            response.put("fileUrl", fileUrl);
            response.put("fileName", originalFileName);

            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(500).body("파일 저장 에러: " + e.getMessage());
        }
    }
}