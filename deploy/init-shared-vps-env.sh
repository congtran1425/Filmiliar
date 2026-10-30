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
# Filmiliar Production VPS Environment Configuration
FILMILIAR_DB_PASSWORD=$db_password
FILMILIAR_JWT_SECRET=$jwt_secret
FILMILIAR_CORS_ORIGIN=http://localhost:5173,https://filmiliar.congtc145.id.vn
FILMILIAR_DEMO_CATALOG=true
FILMILIAR_ENABLE_UPLOADS=false
FILMILIAR_PAYMENT_MODE=disabled
FILMILIAR_ZALOPAY_APP_ID=2553
FILMILIAR_ZALOPAY_KEY1=
FILMILIAR_ZALOPAY_KEY2=
FILMILIAR_ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/create
FILMILIAR_ZALOPAY_QUERY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/query
FILMILIAR_ZALOPAY_CALLBACK_URL=https://api-filmiliar.congtc145.id.vn/api/payment/callback
FILMILIAR_STORAGE_MODE=http_api
FILMILIAR_MEDIA_PUBLIC_URL=https://media.congtc145.id.vn
FILMILIAR_INET_UPLOAD_ENDPOINT=https://media.congtc145.id.vn/api_upload.php
FILMILIAR_INET_UPLOAD_SECRET_KEY=
EOF
chmod 600 "$config_file"
unset db_password jwt_secret
echo "Created private Filmiliar env on VPS (mode 600)."
