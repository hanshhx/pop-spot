package com.example.popspotbackend.service.backup;

import io.sentry.Sentry;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * v2.17 — PostgreSQL 자동 백업 cron.
 *
 * <p>매일 03:00 KST 에 {@code pg_dump} 를 ProcessBuilder 로 직접 호출해 {@code backups/} 폴더에 압축된 custom-format
 * 파일(.dump)로 저장한다. 셸 파이프를 쓰지 않아 pg_dump 실패를 gzip 성공으로 오인하지 않는다. 7일 보관 후 자동 삭제.
 *
 * <p>설정 키:
 *
 * <ul>
 *   <li>{@code popspot.backup.enabled} — 운영 환경에서만 true (기본 false)
 *   <li>{@code popspot.backup.cron} — 기본 매일 03:00
 *   <li>{@code popspot.backup.dir} — 저장 디렉토리 (기본 ./backups)
 *   <li>{@code popspot.backup.retention-days} — 보관 일수 (기본 7)
 *   <li>{@code popspot.backup.pg-dump-path} — pg_dump 실행 경로 (기본 PATH 안)
 * </ul>
 *
 * <p>운영 환경에서는 본 백업과 별개로 NAS / Proxmox 의 시스템 백업 (스냅샷 / RAID) 을 함께 운영할 것을 권장. 본 cron 은
 * application-level 백업 (논리 dump) 이라 빠른 복구에 유리.
 */
@Slf4j
@Component
public class DatabaseBackupScheduler {

    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final String BACKUP_FILE_PREFIX = "popspot-";
    private static final String BACKUP_FILE_SUFFIX = ".dump";
    private static final String LEGACY_BACKUP_FILE_SUFFIX = ".sql.gz";
    private static final long PROCESS_TIMEOUT_SECONDS = 1800L; // 30분

    private volatile LocalDateTime lastAttemptAt;
    private volatile LocalDateTime lastSuccessAt;
    private volatile String lastFailure;
    private volatile String lastFile;
    private volatile long lastFileBytes;

    @Value("${popspot.backup.enabled:false}")
    private boolean enabled;

    @Value("${popspot.backup.dir:./backups}")
    private String backupDir;

    @Value("${popspot.backup.retention-days:7}")
    private int retentionDays;

    @Value("${popspot.backup.pg-dump-path:pg_dump}")
    private String pgDumpPath;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${spring.datasource.username:}")
    private String datasourceUsername;

    @Value("${spring.datasource.password:}")
    private String datasourcePassword;

    @Scheduled(cron = "${popspot.backup.cron:0 0 3 * * *}", zone = "Asia/Seoul")
    public void scheduledBackup() {
        if (!enabled) {
            log.debug("[DB-Backup] disabled — 스킵");
            return;
        }
        lastAttemptAt = LocalDateTime.now();
        log.info("[DB-Backup] === 시작 ===");
        try {
            File outputFile = runPgDump();
            lastSuccessAt = LocalDateTime.now();
            lastFailure = null;
            lastFile = outputFile.getName();
            lastFileBytes = outputFile.length();
            log.info(
                    "[DB-Backup] 완료 — {} ({} bytes)",
                    outputFile.getAbsolutePath(),
                    outputFile.length());
            cleanupOldBackups();
        } catch (Exception e) {
            lastFailure = e.getClass().getSimpleName() + ": " + safeMessage(e.getMessage());
            log.error("[DB-Backup] 실패: {}", e.getClass().getSimpleName(), e);
            Sentry.captureException(e);
        }
    }

    /** 관리자 점검용 상태. DB 비밀번호·호스트·절대 경로는 노출하지 않는다. */
    public Map<String, Object> status() {
        File observed = latestBackupFile();
        LocalDateTime observedSuccessAt =
                lastSuccessAt != null
                        ? lastSuccessAt
                        : observed == null
                                ? null
                                : LocalDateTime.ofInstant(
                                        Instant.ofEpochMilli(observed.lastModified()),
                                        ZoneId.systemDefault());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", enabled);
        out.put("retentionDays", retentionDays);
        out.put("lastAttemptAt", lastAttemptAt);
        out.put("lastSuccessAt", observedSuccessAt);
        out.put("lastFailure", lastFailure);
        out.put(
                "lastFile",
                lastFile != null ? lastFile : observed == null ? null : observed.getName());
        out.put(
                "lastFileBytes",
                lastFile != null ? lastFileBytes : observed == null ? 0L : observed.length());
        out.put(
                "healthy",
                enabled
                        && observedSuccessAt != null
                        && observedSuccessAt.isAfter(LocalDateTime.now().minusDays(2))
                        && lastFailure == null);
        return out;
    }

    private File latestBackupFile() {
        File[] files =
                new File(backupDir)
                        .listFiles(
                                (dir, name) -> isBackupFileName(name));
        if (files == null || files.length == 0) return null;
        return Arrays.stream(files).max(Comparator.comparingLong(File::lastModified)).orElse(null);
    }

    private File runPgDump() throws IOException, InterruptedException {
        ensureBackupDirExists();
        String timestamp = LocalDateTime.now().format(TIMESTAMP_FORMAT);
        File outputFile = new File(backupDir, BACKUP_FILE_PREFIX + timestamp + BACKUP_FILE_SUFFIX);

        String dbName = extractDatabaseName(datasourceUrl);
        String dbHost = extractHost(datasourceUrl);
        String dbPort = extractPort(datasourceUrl);

        // pg_dump custom format은 자체 압축되며 pg_restore로 복원한다. 셸을 거치지 않으므로
        // 명령 인젝션과 pipefail 누락으로 인한 빈 백업 성공 오판을 함께 차단한다.
        ProcessBuilder pb =
                new ProcessBuilder(
                        pgDumpPath,
                        "-h",
                        dbHost,
                        "-p",
                        dbPort,
                        "-U",
                        datasourceUsername,
                        "-Fc",
                        "-Z",
                        "9",
                        "-f",
                        outputFile.getAbsolutePath(),
                        dbName);
        // v2.22 — 비밀번호를 커맨드라인 대신 환경변수로 전달 (ps / process list 노출 방지).
        pb.environment().put("PGPASSWORD", datasourcePassword == null ? "" : datasourcePassword);
        pb.redirectErrorStream(true);

        Process process = pb.start();
        ByteArrayOutputStream processOutput = new ByteArrayOutputStream();
        Thread outputDrainer =
                Thread.startVirtualThread(
                        () -> {
                            try {
                                process.getInputStream().transferTo(processOutput);
                            } catch (IOException ignored) {
                                // 종료 코드와 파일 검증에서 실패로 처리한다.
                            }
                        });
        boolean finished =
                process.waitFor(PROCESS_TIMEOUT_SECONDS, java.util.concurrent.TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            outputDrainer.join();
            Files.deleteIfExists(outputFile.toPath());
            throw new IOException("pg_dump 타임아웃 (30분 초과)");
        }
        outputDrainer.join();
        if (process.exitValue() != 0) {
            Files.deleteIfExists(outputFile.toPath());
            String output = processOutput.toString(StandardCharsets.UTF_8);
            throw new IOException("pg_dump exit " + process.exitValue() + ": " + output);
        }
        if (!outputFile.isFile() || outputFile.length() == 0L) {
            Files.deleteIfExists(outputFile.toPath());
            throw new IOException("pg_dump가 비어 있는 백업 파일을 생성했습니다.");
        }
        restrictFilePermissions(outputFile.toPath());
        return outputFile;
    }

    private void cleanupOldBackups() {
        File dir = new File(backupDir);
        File[] files = dir.listFiles((d, name) -> isBackupFileName(name));
        if (files == null) return;

        long cutoff = System.currentTimeMillis() - retentionDays * 24L * 60 * 60 * 1000;
        Arrays.stream(files)
                .filter(f -> f.lastModified() < cutoff)
                .sorted(Comparator.comparingLong(File::lastModified))
                .forEach(
                        f -> {
                            try {
                                Files.deleteIfExists(f.toPath());
                                log.info("[DB-Backup] 옛 백업 삭제 — {}", f.getName());
                            } catch (IOException e) {
                                log.warn("[DB-Backup] 옛 백업 삭제 실패 — {}", f.getName());
                            }
                        });
    }

    private void ensureBackupDirExists() throws IOException {
        Path dir = Paths.get(backupDir);
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        restrictDirPermissions(dir);
    }

    /**
     * 백업 디렉토리를 소유자 전용(700)으로 제한. SQL 덤프는 전체 PII 를 담으므로 다른 로컬 계정이 읽지 못하게 한다. POSIX 가 아닌 환경(Windows
     * dev)에서는 조용히 건너뛴다.
     */
    private void restrictDirPermissions(Path dir) {
        try {
            if (dir.getFileSystem().supportedFileAttributeViews().contains("posix")) {
                Files.setPosixFilePermissions(dir, PosixFilePermissions.fromString("rwx------"));
            }
        } catch (IOException | UnsupportedOperationException e) {
            log.warn("[DB-Backup] 백업 디렉토리 권한 설정 실패(무시): {}", e.getClass().getSimpleName());
        }
    }

    /** jdbc:postgresql://host:port/dbname → dbname. */
    private String extractDatabaseName(String url) {
        if (url == null) return "";
        int lastSlash = url.lastIndexOf('/');
        if (lastSlash < 0) return "";
        String tail = url.substring(lastSlash + 1);
        int q = tail.indexOf('?');
        return q >= 0 ? tail.substring(0, q) : tail;
    }

    private String extractHost(String url) {
        if (url == null || !url.contains("://")) return "localhost";
        String afterScheme = url.substring(url.indexOf("://") + 3);
        int colon = afterScheme.indexOf(':');
        int slash = afterScheme.indexOf('/');
        if (colon >= 0 && (slash < 0 || colon < slash)) {
            return afterScheme.substring(0, colon);
        }
        return slash >= 0 ? afterScheme.substring(0, slash) : afterScheme;
    }

    private String extractPort(String url) {
        if (url == null || !url.contains("://")) return "5432";
        String afterScheme = url.substring(url.indexOf("://") + 3);
        int colon = afterScheme.indexOf(':');
        int slash = afterScheme.indexOf('/');
        if (colon >= 0 && slash > colon) {
            return afterScheme.substring(colon + 1, slash);
        }
        return "5432";
    }

    private static boolean isBackupFileName(String name) {
        return name.startsWith(BACKUP_FILE_PREFIX)
                && (name.endsWith(BACKUP_FILE_SUFFIX)
                        || name.endsWith(LEGACY_BACKUP_FILE_SUFFIX));
    }

    private void restrictFilePermissions(Path file) {
        try {
            if (file.getFileSystem().supportedFileAttributeViews().contains("posix")) {
                Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
            }
        } catch (IOException | UnsupportedOperationException e) {
            log.warn("[DB-Backup] 백업 파일 권한 설정 실패(무시): {}", e.getClass().getSimpleName());
        }
    }

    private String safeMessage(String value) {
        if (value == null) return "unknown";
        return value.length() > 300 ? value.substring(0, 300) : value;
    }

    /** Mover 메서드가 실제로 호출되었는지 단위 테스트에서 검증할 때 사용. 운영에서는 호출 안 함. */
    @SuppressWarnings("unused")
    void moveFileForTesting(Path src, Path dest) throws IOException {
        Files.move(src, dest, StandardCopyOption.REPLACE_EXISTING);
    }
}
