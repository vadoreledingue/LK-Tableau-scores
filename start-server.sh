#!/usr/bin/env bash
set -euo pipefail

RESTART_DELAY_SECONDS="${RESTART_DELAY_SECONDS:-2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/server.js"

if [[ ! -f "$SERVER_SCRIPT" ]]; then
  echo "Fichier introuvable: $SERVER_SCRIPT" >&2
  exit 1
fi

echo "Demarrage supervise de Kinshima (web + API)..."
echo "Script: $SERVER_SCRIPT"

while true; do
  echo "Lancement Node..."
  node "$SERVER_SCRIPT"
  EXIT_CODE="$?"

  if [[ "$EXIT_CODE" -eq 0 ]]; then
    echo "Serveur arrete normalement (code 0)."
    break
  fi

  echo "Serveur stoppe (code $EXIT_CODE). Redemarrage dans ${RESTART_DELAY_SECONDS}s..."
  sleep "$RESTART_DELAY_SECONDS"
done
