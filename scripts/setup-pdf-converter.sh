#!/usr/bin/env bash
# Install DOCX→PDF support on Ubuntu/Debian VPS (RC & TCC certificate downloads).
set -euo pipefail

echo "==> Installing LibreOffice Writer..."
sudo apt-get update
sudo apt-get install -y libreoffice-writer
soffice --version || libreoffice --version

echo ""
echo "Done. Restart your portal app (e.g. pm2 restart all)."
echo ""
echo "Optional — Gotenberg via Docker (often faster):"
echo "  docker compose -f docker-compose.gotenberg.yml up -d"
echo "  Add to .env: GOTENBERG_URL=http://127.0.0.1:3001"
