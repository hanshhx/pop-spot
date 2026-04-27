#!/usr/bin/env bash
# =================================================================
# PostgreSQL 17 / 16 초기 셋업 (GCP VM 동일 호스트)
# Ubuntu 22.04 / 24.04 가정
# =================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-popspot_db}"
DB_USER="${DB_USER:-popspot_user}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD 환경변수를 먼저 export 하세요}"

if [[ "$EUID" -ne 0 ]]; then
    echo "❌ root 권한 필요"; exit 1
fi

echo "==> 1. PostgreSQL 설치 (없으면)"
apt-get update -y
apt-get install -y postgresql postgresql-contrib

systemctl enable postgresql
systemctl start postgresql

echo "==> 2. DB / 유저 생성 (idempotent)"
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "==> 3. localhost only listen (외부 노출 차단)"
PGCONF=$(ls /etc/postgresql/*/main/postgresql.conf | head -n1)
sed -i "s/^#listen_addresses.*/listen_addresses = 'localhost'/" "$PGCONF" || true

echo "==> 4. pg_hba.conf — 동일 호스트 md5 인증"
HBA=$(ls /etc/postgresql/*/main/pg_hba.conf | head -n1)
if ! grep -q "popspot" "$HBA"; then
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    scram-sha-256" >> "$HBA"
    echo "host    ${DB_NAME}    ${DB_USER}    ::1/128         scram-sha-256" >> "$HBA"
fi

systemctl restart postgresql

echo ""
echo "✅ PostgreSQL 셋업 완료"
echo "   접속 테스트: psql -h 127.0.0.1 -U ${DB_USER} -d ${DB_NAME}"
echo ""
echo "⚠️  이제 /etc/popspot/popspot.env 의 DB_PASSWORD 가 위 비밀번호와 일치하는지 반드시 확인하세요."
