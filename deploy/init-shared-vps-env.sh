#!/usr/bin/env bash
set -euo pipefail

config_dir=/opt/apps/filmiliar/config
config_file="$config_dir/.env"
if [[ -e "$config_file" ]]; then
  echo "Filmiliar env already exists; refusing to overwrite it."
  exit 1
fi

install -d -m 700 "$config_dir"
db_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 48)"
umask 077
cat > "$config_file" <<EOF
FILMILIAR_DB_PASSWORD=$db_password
FILMILIAR_JWT_SECRET=$jwt_secret
FILMILIAR_CORS_ORIGIN=http://localhost:5173
EOF
chmod 600 "$config_file"
unset db_password jwt_secret
echo "Created private Filmiliar env on VPS (mode 600)."
