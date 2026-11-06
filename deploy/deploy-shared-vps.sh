#!/usr/bin/env bash
set -euo pipefail

repo=/opt/apps/filmiliar/repo
config=/opt/apps/filmiliar/config/.env
state=/opt/apps/filmiliar/config/deployment.env
compose="$repo/compose.shared-vps.yaml"
test -f "$config" || { echo "Missing private Filmiliar env." >&2; exit 1; }
test -f "$state" || { echo "Missing deployment.env with the prebuilt API image. Build images in CI, not on this VPS." >&2; exit 1; }
test -f "$compose" || { echo "Missing Filmiliar Compose file." >&2; exit 1; }

docker_compose=(sudo -n docker compose --env-file "$config" --env-file "$state" -f "$compose" --project-directory "$repo")
"${docker_compose[@]}" config --quiet
"${docker_compose[@]}" up -d db
"${docker_compose[@]}" pull api
if [[ -x /usr/local/sbin/filmiliar-backup ]]; then sudo -n /usr/local/sbin/filmiliar-backup; fi
"${docker_compose[@]}" run --rm --no-deps --interactive=false -T --user root api node node_modules/prisma/build/index.js migrate deploy --schema=apps/server/prisma/schema.prisma
"${docker_compose[@]}" up -d --no-build api
"${docker_compose[@]}" ps
ready=false
for attempt in {1..20}; do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3081/api/health >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
test "$ready" = true || { echo "Filmiliar API did not become healthy." >&2; exit 1; }
echo "Filmiliar API responds on VPS loopback port 3081."
