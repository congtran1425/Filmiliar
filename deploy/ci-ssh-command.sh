#!/usr/bin/env bash
set -euo pipefail

# Installed root-owned. The CI key cannot request a shell or an arbitrary command.
command=${SSH_ORIGINAL_COMMAND:-}
if [[ "$command" =~ ^deploy\ ([0-9a-f]{40})\ (sha256:[0-9a-f]{64})\ ([a-zA-Z0-9_-]+(\[bot\])?)$ ]]; then
  exec sudo -n /usr/local/sbin/filmiliar-ci-deploy "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
fi
echo 'This key only accepts a Filmiliar deployment command.' >&2
exit 64
