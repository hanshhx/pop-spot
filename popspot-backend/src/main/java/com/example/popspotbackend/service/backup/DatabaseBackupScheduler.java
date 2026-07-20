package com.example.popspotbackend.service.backup;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * v2.17 — PostgreSQL 자동 백업 cron.
 *
 * <p>매일 03:00 KST 에 {@code pg_dump} 를 ProcessBuilder 로 호출해 {@code backups/} 폴더에 압축 파일 (.sql.gz) 로
 * 저장한다. 7일 보관 후 자동 삭제.
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
    private static final String BACKUP_FILE_SUFFIX = ".sql.gz";
    private static final long PROCESS_TIMEOUT_SECONDS = 1800L; // 30분

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
        log.info("[DB-Backup] === 시작 ===");
        try {
            File outputFile = runPgDump();
            log.info(
                    "[DB-Backup] 완료 — {} ({} bytes)",
                    outputFile.getAbsolutePath(),
                    outputFile.length());
            cleanupOldBackups();
        } catch (Exception e) {
            log.error("[DB-Backup] 실패: {}", e.getClass().getSimpleName(), e);
        }
    }

    private File runPgDump() throws IOException, InterruptedException {
        ensureBackupDirExists();
        String timestamp = LocalDateTime.now().format(TIMESTAMP_FORMAT);
        File outputFile = new File(backupDir, BACKUP_FILE_PREFIX + timestamp + BACKUP_FILE_SUFFIX);

        String dbName = extractDatabaseName(datasourceUrl);
        String dbHost = extractHost(datasourceUrl);
        String dbPort = extractPort(datasourceUrl);

        // pg_dump -h host -p port -U user dbName | gzip > outputFile
        // v2.22 — 모든 설정 유래 값을 single-quote escape (shell 인젝션 방어 강화).
        ProcessBuilder pb =
                new ProcessBuilder(
                        "/bin/sh",
                        "-c",
                        String.format(
                                "'%s' -h '%s' -p '%s' -U '%s' -F p '%s' | gzip > '%s'",
                                escapeShell(pgDumpPath),
                                escapeShell(dbHost),
                                escapeShell(dbPort),
                                escapeShell(datasourceUsername),
                                escapeShell(dbName),
                                escapeShell(outputFile.getAbsolutePath())));
        // v2.22 — 비밀번호를 커맨드라인 대신 환경변수로 전달 (ps / process list 노출 방지).
        pb.environment().put("PGPASSWORD", datasourcePassword == null ? "" : datasourcePassword);
        pb.redirectErrorStream(true);

        Process process = pb.start();
        boolean finished =
                process.waitFor(PROCESS_TIMEOUT_SECONDS, java.util.concurrent.TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IOException("pg_dump 타임아웃 (30분 초과)");
        }
        if (process.exitValue() != 0) {
            String output = new String(process.getInputStream().readAllBytes());
            throw new IOException("pg_dump exit " + process.exitValue() + ": " + output);
        }
        return outputFile;
    }

    private void cleanupOldBackups() {
        File dir = new File(backupDir);
        File[] files = dir.listFiles((d, name) -> name.startsWith(BACKUP_FILE_PREFIX));
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

    private String escapeShell(String value) {
        if (value == null) return "";
        return value.replace("'", "'\\''");
    }

    /** Mover 메서드가 실제로 호출되었는지 단위 테스트에서 검증할 때 사용. 운영에서는 호출 안 함. */
    @SuppressWarnings("unused")
    void moveFileForTesting(Path src, Path dest) throws IOException {
        Files.move(src, dest, StandardCopyOption.REPLACE_EXISTING);
    }
}
