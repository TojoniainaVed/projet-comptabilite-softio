#!/usr/bin/env bash
# Installe les dépendances du backend et du frontend et prépare les fichiers d'environnement.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Backend (Composer)"
(cd backend && composer install && { [ -f .env ] || cp .env.example .env; } && php artisan key:generate --ansi)

echo "==> Frontend (npm)"
(cd frontend && npm install && { [ -f .env ] || cp .env.example .env; })

cat <<'MSG'

Étapes suivantes :
  1. Créez la base PostgreSQL (voir README.md) et renseignez DB_PASSWORD / SEED_ADMIN_PASSWORD dans backend/.env
  2. cd backend && php artisan migrate && php artisan db:seed && php artisan serve
  3. cd frontend && npm run dev
MSG
