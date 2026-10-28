#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$HOME/Event-ChatX"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"

# Đọc biến môi trường từ file .env
set -a
source .env
set +a

echo "[$(date)] Starting MySQL backup..."
docker compose -f compose.production.yaml exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction -u root eventchat_db' \
  | gzip > "$BACKUP_DIR/mysql_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting MongoDB backup..."
docker compose -f compose.production.yaml exec -T mongo \
  mongodump --archive --gzip -u eventchat -p "$MONGO_PASSWORD" --authenticationDatabase admin --db eventchat \
  > "$BACKUP_DIR/mongo_${TIMESTAMP}.archive.gz"

# Xóa các file backup cũ hơn 7 ngày để không đầy ổ cứng
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +7 -delete
echo "[$(date)] Backup completed successfully in $BACKUP_DIR"