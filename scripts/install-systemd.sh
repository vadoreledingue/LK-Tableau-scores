#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="kinshima.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_USER="${SUDO_USER:-$(whoami)}"
TARGET_FILE="/etc/systemd/system/${SERVICE_NAME}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Lance ce script avec sudo."
  exit 1
fi

if [[ ! -d "${PROJECT_DIR}/node_modules/better-sqlite3" ]]; then
  echo "Installation des dependances npm..."
  (cd "$PROJECT_DIR" && npm install --omit=dev)
fi

cat > "$TARGET_FILE" <<EOF
[Unit]
Description=Kinshima web + API server
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${PROJECT_DIR}
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/env bash ${PROJECT_DIR}/scripts/start-server.sh
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

echo "Service installe et demarre: $SERVICE_NAME"
echo "Verifier: sudo systemctl status $SERVICE_NAME"
