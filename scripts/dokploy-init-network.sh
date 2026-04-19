#!/usr/bin/env sh
# Crea la red Docker externa que esperan docker-compose.prod.yml y docker-compose.web.yml
# si aún no existe. Ejecutar en el servidor donde corre Dokploy (una vez).

set -eu

NET_NAME="${DOKPLOY_NETWORK_NAME:-dokploy-network}"

if docker network inspect "$NET_NAME" >/dev/null 2>&1; then
  echo "Red '$NET_NAME' ya existe."
  exit 0
fi

docker network create "$NET_NAME"
echo "Creada red Docker: $NET_NAME"
