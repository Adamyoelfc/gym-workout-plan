#!/usr/bin/env bash
set -Eeuo pipefail

for argument in "$@"; do
  if [[ "$argument" == "-v" || "$argument" == "--volumes" ]]; then
    echo "Refusing $argument: it would delete the production database volume." >&2
    exit 2
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"
exec docker compose -f docker-compose.yml -f compose.production.yml "$@"
