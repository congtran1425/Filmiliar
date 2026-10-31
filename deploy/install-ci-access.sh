#!/usr/bin/env bash
set -euo pipefail

[[ $EUID -eq 0 && $# -eq 1 ]] || { echo 'Run as root with the CI public key file path.' >&2; exit 64; }
key_file=$1
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
user=filmiliar-ci
public_key=$(cat "$key_file")
[[ "$public_key" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || { echo 'Expected an Ed25519 public key.' >&2; exit 64; }

if ! id "$user" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/filmiliar-ci --shell /bin/bash "$user"
fi
[[ $(id -Gn "$user") == "$user" ]] || { echo 'CI user must not belong to privileged groups.' >&2; exit 1; }
install -d -o root -g root -m 755 /var/lib/filmiliar-ci
install -d -o root -g root -m 755 /var/lib/filmiliar-ci/.ssh
install -o root -g root -m 755 "$source_dir/ci-ssh-command.sh" /usr/local/bin/filmiliar-ci-ssh
install -o root -g root -m 755 "$source_dir/ci-deploy.sh" /usr/local/sbin/filmiliar-ci-deploy
printf 'restrict,command="/usr/local/bin/filmiliar-ci-ssh" %s\n' "$public_key" > /var/lib/filmiliar-ci/.ssh/authorized_keys
chown root:root /var/lib/filmiliar-ci/.ssh/authorized_keys
chmod 644 /var/lib/filmiliar-ci/.ssh/authorized_keys
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/filmiliar-ci-deploy *\n' "$user" > /etc/sudoers.d/filmiliar-ci
chmod 440 /etc/sudoers.d/filmiliar-ci
visudo -cf /etc/sudoers.d/filmiliar-ci
echo 'Installed dedicated, forced-command Filmiliar CI access.'
