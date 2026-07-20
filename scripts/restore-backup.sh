#!/usr/bin/env sh
# Restore a nightly backup into the docker compose volume.
#
#   ./scripts/restore-backup.sh data/backups/tracker-2026-07-19.db
#
# Stops the app, replaces /data/tracker.db in the tracker-data volume
# (clearing any stale WAL files), and starts the app again. The replaced
# database is kept in the volume as tracker.db.pre-restore just in case.
set -eu

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path-to-backup.db>" >&2
  echo "Available backups:" >&2
  ls -1 data/backups/tracker-*.db 2>/dev/null >&2 || echo "  (none found locally — check the volume: docker compose cp tracker:/data/backups ./data/)" >&2
  exit 1
fi

VOLUME="$(docker compose config --format json | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const c=JSON.parse(d);console.log(Object.keys(c.volumes)[0] ? c.name + "_" + Object.keys(c.volumes)[0] : "")})')"
if [ -z "$VOLUME" ]; then
  echo "Could not determine the compose volume name" >&2
  exit 1
fi

echo "Restoring $BACKUP_FILE into volume $VOLUME"
docker compose stop tracker

docker run --rm \
  -v "$VOLUME":/data \
  -v "$(cd "$(dirname "$BACKUP_FILE")" && pwd)":/backups:ro \
  alpine sh -c "
    cp /data/tracker.db /data/tracker.db.pre-restore 2>/dev/null || true
    rm -f /data/tracker.db-wal /data/tracker.db-shm
    cp /backups/$(basename "$BACKUP_FILE") /data/tracker.db
    chown 1000:1000 /data/tracker.db
  "

docker compose start tracker
echo "Restored. Previous database kept at /data/tracker.db.pre-restore in the volume."
