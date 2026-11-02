#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/var/opt/backups"
DB_CONTAINER="db"
DB_NAME="postgres"
DB_USER="postgres"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/supabase_db_backup_$TIMESTAMP.sql.gz"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# Create the backup
echo "Creating backup of Supabase database..."
docker exec $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE

# Optional: Remove old backups (e.g., older than 7 days)
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;

echo "Backup complete: $BACKUP_FILE"
