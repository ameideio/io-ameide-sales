#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/stack/oidc/docker-compose.yml"

export FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-http://localhost:3000}"
export BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://localhost:3000}"
export KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8080}"
export KEYCLOAK_USERNAME="${KEYCLOAK_USERNAME:-tim@apple.dev}"
export KEYCLOAK_PASSWORD="${KEYCLOAK_PASSWORD:-tim@apple.dev}"

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

cleanup() {
  # Keep logs available on failure; caller can run `docker compose logs` if needed.
  compose down -v --remove-orphans || true
}

trap cleanup EXIT

echo "[e2e-oidc] Starting stack..."
compose up -d --build

echo "[e2e-oidc] Waiting for Keycloak discovery..."
for i in $(seq 1 120); do
  if curl -fsS "${KEYCLOAK_BASE_URL}/realms/ameide/.well-known/openid-configuration" >/dev/null; then
    break
  fi
  sleep 1
done

echo "[e2e-oidc] Waiting for Twenty /healthz..."
for i in $(seq 1 240); do
  if curl -fsS "${BACKEND_BASE_URL}/healthz" >/dev/null; then
    break
  fi
  sleep 1
done

echo "[e2e-oidc] Seeding dev workspace data (workspace:seed:dev)..."
compose exec -T server yarn command:prod workspace:seed:dev >/dev/null

echo "[e2e-oidc] Running Playwright..."
cd "${ROOT_DIR}"
yarn playwright test --project=oidc tests/authentication/ameide-oidc.spec.ts

