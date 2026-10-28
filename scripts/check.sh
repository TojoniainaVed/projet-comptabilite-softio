#!/usr/bin/env bash
# Lance toutes les vérifications automatiques des deux projets.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Backend : style (Pint) et tests (PHPUnit)"
(cd backend && vendor/bin/pint --test && php artisan test)

echo "==> Frontend : typecheck, lint, format, tests, build"
(cd frontend && npm run check && npm run build)

echo "Toutes les vérifications ont réussi."
