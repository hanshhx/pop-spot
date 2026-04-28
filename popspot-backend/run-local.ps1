# =================================================================
# popspot-backend 로컬 실행 헬퍼 (Windows PowerShell)
#
# 사용법:
#   1. .env.local 파일을 같은 폴더에 만들어 KEY=VALUE 형식으로 채움
#   2. PowerShell 에서:  .\run-local.ps1
#
# 특징:
#   - .env.local 의 모든 KEY=VALUE 를 현재 세션 환경변수로 export
#   - 따옴표 처리 + 주석(#) + 빈 줄 무시
#   - 그 후 ./gradlew bootRun 자동 실행
#
# 주의: Spring Boot 는 .env 파일 자체를 읽지 않으므로 이 스크립트가 다리 역할.
# =================================================================

$envFile = Join-Path $PSScriptRoot ".env.local"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env.local 파일이 없습니다." -ForegroundColor Red
    Write-Host "   .env.example 을 복사해 .env.local 로 만들고 값을 채우세요." -ForegroundColor Yellow
    Write-Host "   cp .env.example .env.local" -ForegroundColor Cyan
    exit 1
}

Write-Host "🔑 .env.local 에서 환경변수 로딩 중..." -ForegroundColor Green
$count = 0

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    # 주석 / 빈 줄 무시
    if ($line -eq "" -or $line.StartsWith("#")) { return }

    # KEY=VALUE 파싱
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $key = $matches[1]
        $value = $matches[2]

        # 따옴표 제거 (양쪽 따옴표 둘러싼 경우)
        if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
            $value = $matches[1]
        }

        Set-Item -Path "Env:$key" -Value $value
        $count++
    }
}

Write-Host "✅ $count 개 환경변수 로드 완료" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 ./gradlew bootRun 시작..." -ForegroundColor Cyan
Write-Host ""

# Gradle 실행
.\gradlew bootRun
