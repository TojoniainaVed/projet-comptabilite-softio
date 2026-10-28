#!/usr/bin/env bash
# Génère ../softio-comptabilite.zip sans secrets, caches ni dépendances installées.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="$(basename "$ROOT")"
cd "$ROOT/.."
rm -f "$NAME.zip"
zip -rq "$NAME.zip" "$NAME" \
  -x "*/node_modules/*" "*/vendor/*" "*/dist/*" "*/coverage/*" \
     "*/.env" "*/.env.local" "*/.phpunit.result.cache" \
     "*/storage/logs/*.log" "*/storage/framework/cache/data/*" \
     "*/storage/framework/sessions/*" "*/storage/framework/views/*" \
     "*/bootstrap/cache/*.php" "*.DS_Store"
echo "Créé : $(pwd)/$NAME.zip"
