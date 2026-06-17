#!/usr/bin/env bash
# One-command PDF converter setup for live Linux server (RC/TCC certificates).
# Run on the VPS:  bash scripts/setup-live-pdf.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Pharmegic live PDF converter setup"
echo "    Project: $ROOT"
echo ""

ensure_gotenberg_env() {
  local env_file="$ROOT/.env"
  local line='GOTENBERG_URL=http://127.0.0.1:3001'

  if [[ ! -f "$env_file" ]]; then
    echo "$line" >"$env_file"
    echo "==> Created .env with GOTENBERG_URL"
    return
  fi

  if grep -q '^GOTENBERG_URL=' "$env_file"; then
    sed -i 's|^GOTENBERG_URL=.*|GOTENBERG_URL=http://127.0.0.1:3001|' "$env_file"
    echo "==> Updated GOTENBERG_URL in .env"
  else
    echo "$line" >>"$env_file"
    echo "==> Added GOTENBERG_URL to .env"
  fi
}

restart_app() {
  if command -v pm2 >/dev/null 2>&1; then
    echo "==> Restarting app (pm2)..."
    pm2 restart all || pm2 restart pharmegic-portal || pm2 restart 0 || true
  elif systemctl is-active --quiet pharmegic-portal 2>/dev/null; then
    echo "==> Restarting app (systemctl)..."
    sudo systemctl restart pharmegic-portal
  else
    echo "==> Restart your Node app manually (pm2 restart all or systemctl)."
  fi
}

wait_for_gotenberg() {
  local i
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

try_gotenberg_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "==> Docker not installed — skipping Gotenberg."
    return 1
  fi

  echo "==> Starting Gotenberg (Docker)..."
  docker compose -f docker-compose.gotenberg.yml up -d

  echo "==> Waiting for Gotenberg health..."
  if wait_for_gotenberg; then
    curl -s http://127.0.0.1:3001/health || true
    echo ""
    ensure_gotenberg_env
    restart_app
    echo ""
    echo "SUCCESS: Gotenberg is running on http://127.0.0.1:3001"
    return 0
  fi

  echo "==> Gotenberg container started but health check failed."
  docker compose -f docker-compose.gotenberg.yml logs --tail=20 || true
  return 1
}

try_libreoffice() {
  echo "==> Installing LibreOffice Writer (fallback)..."
  sudo apt-get update
  sudo apt-get install -y libreoffice-writer
  soffice --version || libreoffice --version
  restart_app
  echo ""
  echo "SUCCESS: LibreOffice installed."
}

if try_gotenberg_docker; then
  :
elif try_libreoffice; then
  :
else
  echo ""
  echo "FAILED: Install Docker first, then re-run:"
  echo "  curl -fsSL https://get.docker.com | sudo sh"
  echo "  sudo usermod -aG docker \$USER"
  echo "  bash scripts/setup-live-pdf.sh"
  exit 1
fi

echo ""
echo "==> Verify in browser:"
echo "    https://portal.pharmegichealthcare.com/api/health/pdf-converter"
echo "    pdfConversionAvailable should be true"
