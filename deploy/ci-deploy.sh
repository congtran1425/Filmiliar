#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ $EUID -eq 0 && $# -eq 3 ]] || { echo 'Expected root and revision, image digest, registry user.' >&2; exit 64; }
revision=$1
digest=$2
registry_user=$3
[[ "$revision" =~ ^[0-9a-f]{40}$ && "$digest" =~ ^sha256:[0-9a-f]{64}$ && "$registry_user" =~ ^[a-zA-Z0-9_-]+(\[bot\])?$ ]] || exit 64
IFS= read -r -t 30 registry_token || { echo 'Missing temporary registry token.' >&2; exit 64; }
[[ ${#registry_token} -ge 20 && ${#registry_token} -le 4096 ]] || exit 64

base=/opt/apps/filmiliar
repo=$base/repo
config=$base/config/.env
state=$base/config/deployment.env
image=ghcr.io/congtran1425/filmiliar-api@$digest
registry_config=
pending_env=
health_file=
switched=false
successful=false
previous_image=
previous_revision=unknown

wait_for_health() {
  local expected=$1
  for attempt in {1..45}; do
    if curl -fsS --max-time 3 http://127.0.0.1:3081/api/health > "$health_file"; then
      if EXPECTED_REVISION="$expected" python3 -c 'import json,os,sys;h=json.load(sys.stdin);r=os.environ["EXPECTED_REVISION"];sys.exit(0 if (r=="unknown" or h.get("revision")==r) and h.get("database",{}).get("status")=="connected" else 1)' < "$health_file"; then
        [[ $(docker inspect filmiliar-api-1 --format '{{.State.Health.Status}}') == healthy ]] && return 0
      fi
    fi
    sleep 2
  done
  return 1
}

exec 9>/run/lock/filmiliar-deploy.lock
flock -w 600 9 || { echo 'Another Filmiliar deployment is still running.' >&2; exit 75; }

cleanup() {
  result=$?
  trap - EXIT
  if [[ "$successful" != true && "$switched" == true && -n "$previous_image" ]]; then
    echo 'New API failed. Restoring the previous Filmiliar API image.' >&2
    printf 'FILMILIAR_API_IMAGE=filmiliar-api:rollback-last\nFILMILIAR_DEPLOY_REVISION=%s\n' "$previous_revision" > "$pending_env"
    if "${compose[@]}" up -d --no-deps --no-build --pull never api && wait_for_health "$previous_revision"; then
      install -m 600 "$pending_env" "$state"
      echo 'Previous API image restored; database migrations were not reversed.' >&2
    else
      echo 'API rollback failed; inspect the Filmiliar service immediately.' >&2
    fi
  fi
  [[ -z "$pending_env" ]] || rm -f -- "$pending_env"
  [[ -z "$health_file" ]] || rm -f -- "$health_file"
  if [[ -n "$registry_config" && "$registry_config" == "$base/config/.registry-"* ]]; then rm -rf -- "$registry_config"; fi
  exit "$result"
}
trap cleanup EXIT

as_owner() { runuser -u ubuntu -- "$@"; }
test -f "$config" && test -d "$repo/.git"
[[ $(as_owner git -C "$repo" symbolic-ref --short HEAD) == main ]] || { echo 'VPS checkout must be on main.' >&2; exit 1; }
[[ -z $(as_owner git -C "$repo" status --porcelain --untracked-files=no) ]] || { echo 'VPS has uncommitted tracked changes.' >&2; exit 1; }
as_owner git -C "$repo" fetch origin main
[[ $(as_owner git -C "$repo" rev-parse origin/main) == "$revision" ]] || { echo 'Deployment superseded: requested SHA is not current origin/main.' >&2; exit 1; }
as_owner git -C "$repo" merge --ff-only "$revision"
[[ $(docker inspect filmiliar-db-1 --format '{{.State.Health.Status}}') == healthy ]] || { echo 'Filmiliar database is not healthy.' >&2; exit 1; }
available=$(df --output=avail -B1 "$base" | tail -1 | tr -d ' ')
(( available >= 2147483648 )) || { echo 'Less than 2 GiB free for a safe deployment.' >&2; exit 1; }

registry_config=$(mktemp -d "$base/config/.registry-XXXXXX")
printf '%s' "$registry_token" | docker --config "$registry_config" login ghcr.io --username "$registry_user" --password-stdin
unset registry_token
docker --config "$registry_config" pull "$image"
[[ $(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}') == "$revision" ]] || { echo 'Image revision label does not match Git commit.' >&2; exit 1; }
[[ $(docker image inspect "$image" --format '{{.Architecture}}') == amd64 ]] || exit 1

previous_image=$(docker inspect filmiliar-api-1 --format '{{.Image}}')
previous_revision=$(docker image inspect "$previous_image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
[[ "$previous_revision" =~ ^[0-9a-f]{40}$ ]] || previous_revision=unknown
docker image tag "$previous_image" filmiliar-api:rollback-last
pending_env=$(mktemp "$base/config/.deployment-XXXXXX")
health_file=$(mktemp "$base/config/.health-XXXXXX")
printf 'FILMILIAR_API_IMAGE=%s\nFILMILIAR_DEPLOY_REVISION=%s\n' "$image" "$revision" > "$pending_env"
compose=(docker compose --project-name filmiliar --env-file "$config" --env-file "$pending_env" -f "$repo/compose.shared-vps.yaml" --project-directory "$repo")
"${compose[@]}" config --quiet

# A repository change may not use CI's sudo path to claim another project's ports,
# host directories, Docker socket, network, or volumes on this shared machine.
"${compose[@]}" config --format json | EXPECTED_IMAGE="$image" python3 -c '
import json, os, sys
c=json.load(sys.stdin)
assert c["name"] == "filmiliar" and set(c["services"]) == {"api","db"}, "Unexpected Compose project/services"
a=c["services"]["api"]
assert a["image"] == os.environ["EXPECTED_IMAGE"], "Unexpected API image"
p=a.get("ports", [])
assert len(p)==1 and p[0].get("host_ip")=="127.0.0.1" and str(p[0].get("published"))=="3081" and p[0]["target"]==5000, "Unexpected API port"
assert not c["services"]["db"].get("ports"), "Database port must stay internal"
assert set(c.get("networks", {})) == {"default"}, "Unexpected network"
assert c["networks"]["default"].get("name")=="filmiliar_default" and not c["networks"]["default"].get("external"), "External network rejected"
assert set(c.get("volumes", {})) == {"filmiliar_db","filmiliar_uploads"}, "Unexpected volumes"
for name, v in c["volumes"].items():
    assert v.get("name")=="filmiliar_"+name and not v.get("external") and not v.get("driver_opts"), "External volume rejected"
for name,s in c["services"].items():
    assert not any(s.get(k) for k in ["privileged","devices","cap_add","network_mode","pid","ipc","volumes_from","extra_hosts"]), "Host privileges rejected"
    assert s.get("networks")=={"default":None} or set(s.get("networks",{}))=={"default"}, "Unexpected service network"
    for v in s.get("volumes",[]):
        assert v["type"]=="volume" and v["source"] in {"filmiliar_db","filmiliar_uploads"}, "Host bind mount rejected"
        assert v["target"] in {"/app/uploads","/var/lib/postgresql/data"}, "Unexpected mount target"
assert "ALL" in a.get("cap_drop",[]) and a.get("user", "node") in ["node","1000","1000:1000"], "API privileges rejected"
print("Validated Filmiliar project isolation.")
'

install -d -m 700 "$base/backups"
backup="$base/backups/filmiliar-$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}.dump"
docker exec filmiliar-db-1 pg_dump -U filmiliar -d filmiliar -Fc > "$backup.tmp"
docker exec -i filmiliar-db-1 pg_restore --list < "$backup.tmp" >/dev/null
mv "$backup.tmp" "$backup"
echo "Database backup verified: $backup"
"${compose[@]}" run --rm --no-deps --user root api npx prisma migrate deploy --schema=apps/server/prisma/schema.prisma

switched=true
"${compose[@]}" up -d --no-deps --no-build --pull never api
wait_for_health "$revision" || { echo 'API did not become healthy at the expected revision.' >&2; exit 1; }
install -m 600 "$pending_env" "$state"
printf '{"revision":"%s","image":"%s","backup":"%s","deployedAt":"%s"}\n' "$revision" "$image" "$backup" "$(date -u +%FT%TZ)" > "$base/config/last-deployment.json"
successful=true
echo "Filmiliar API deployed and verified: $revision"

# Reclaim only old Filmiliar images; keep the newest three plus the rollback image.
current_image=$(docker inspect filmiliar-api-1 --format '{{.Image}}')
count=0
while IFS= read -r candidate; do
  count=$((count + 1))
  if (( count <= 3 )) || [[ "$candidate" == "$current_image" || "$candidate" == "$previous_image" ]]; then continue; fi
  docker image rm --no-prune "$candidate" >/dev/null 2>&1 || true
done < <(docker image ls --no-trunc --filter label=org.opencontainers.image.source=https://github.com/congtran1425/Filmiliar --format '{{.ID}}' | awk '!seen[$0]++')
