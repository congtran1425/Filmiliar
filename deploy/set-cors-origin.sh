#!/usr/bin/env bash
set -euo pipefail

config=/opt/apps/filmiliar/config/.env
origins="${1:?Pass a comma-separated list of HTTPS origins}"
[[ "$origins" != *'|'* ]] || { echo "Invalid origin list" >&2; exit 1; }
test -f "$config"
sed -i "s|^FILMILIAR_CORS_ORIGIN=.*|FILMILIAR_CORS_ORIGIN=$origins|" "$config"
chmod 600 "$config"
echo "Updated Filmiliar CORS origin list on VPS."
