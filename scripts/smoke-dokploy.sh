#!/usr/bin/env sh
# Comprobaciones smoke contra un despliegue Dokploy (API pública HTTPS y front opcional).
# Uso: ./scripts/smoke-dokploy.sh https://api.ejemplo.com [https://app.ejemplo.com]

set -eu

API_URL="${1:-}"
FRONT_URL="${2:-}"

if [ -z "$API_URL" ]; then
  echo "Uso: $0 <API_BASE_URL> [FRONT_URL]" >&2
  echo "Ejemplo: $0 https://brain.midominio.com https://app.midominio.com" >&2
  exit 1
fi

fail=0
check() {
  desc=$1
  shift
  if "$@"; then
    echo "OK  $desc"
  else
    echo "FAIL $desc" >&2
    fail=1
  fi
}

check "GET $API_URL/health" curl -fsS "$API_URL/health" >/dev/null

if [ -n "$FRONT_URL" ]; then
  check "GET $FRONT_URL (HTML)" curl -fsS -o /dev/null -L "$FRONT_URL"
fi

exit "$fail"
