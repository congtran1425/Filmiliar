# Filmiliar on a shared 1 GiB VPS

The client stays on Vercel. One host Nginx owns ports 80/443 and forwards
`api-filmiliar.congtc145.id.vn` to `127.0.0.1:3081`. The `filmiliar` Compose
project contains its own API, PostgreSQL 17, network, database and uploads volumes.
PostgreSQL has no published host port. Configuration remains at
`/opt/apps/filmiliar/config/.env` with mode 600.

## Resource allocation

| Service | RAM ceiling | RAM plus swap ceiling | CPU ceiling |
| --- | --- | --- | --- |
| Filmiliar API | 224 MiB | 448 MiB | 0.5 vCPU |
| Filmiliar PostgreSQL | 160 MiB | 320 MiB | 0.3 vCPU |

The host has a 2 GiB swap file and swappiness 10. Swap protects against brief
memory spikes; it does not provide the performance of additional RAM. The API
uses a 128 MiB V8 heap, two libuv threads and three Prisma connections.
PostgreSQL uses 32 MiB shared buffers, 2 MiB work memory, 16 MiB maintenance
memory, 20 connection slots and no parallel query workers. Container logs rotate
at 5 MiB with three files each.

Reserve loopback port 3080 for the future Mot Me Banh API, with a separate
Compose project, network, database credentials and volumes. Before deploying it,
replace its old multi-gigabyte limits with limits appropriate to this host and
measure both applications together. Capacity for two applications is not
established by the Filmiliar deployment alone.

## Releases

Build and test on GitHub Actions. The VPS pulls an immutable GHCR API image;
it never runs npm install, TypeScript compilation or Docker image builds.
`deploy/deploy-shared-vps.sh` also requires the existing `deployment.env`
containing the image reference. CI uses the dedicated forced-command account
`filmiliar-ci`; the administrator's SSH private key is not copied onto the VPS.
Changing servers requires updating `FILMILIAR_VPS_HOST` and
`FILMILIAR_VPS_KNOWN_HOSTS` in GitHub and installing the CI public key on the new
server. Nginx and certificates are managed separately from app releases.

## Recovery and backups

The 2026-11-06 recovery source was the local database, not the disabled old VPS.
The local database had 11 product models, 12 units, two users and one rental.
Keep its original dump unchanged. Baseline the imported copy only after checking
that its structure matches the initial migration; the five missing indexes were
added to the destination copy before applying later migrations. Sync the agreed
14-model catalog with `seed.ts --apply` after reviewing its dry run. Preserve
existing units and history, including unpublished older models.

Install `backup-db.sh` as `/usr/local/sbin/filmiliar-backup` (root-owned, mode
755) and the two files in `systemd/` into `/etc/systemd/system/`. Then enable
`filmiliar-backup.timer`. It writes checked custom-format PostgreSQL dumps under
`/opt/apps/filmiliar/backups/` daily around 03:00 Vietnam time, retaining scheduled
backups for 14 days. Initial source dumps and CI release backups are not deleted
by this timer. Periodically copy backups off the VPS and test a restoration;
a backup stored only on this VPS is insufficient if the instance is lost.

Certbot's timer renews the API certificate. Install a deploy hook that runs
`nginx -t` and reloads Nginx after renewal.

The replacement machine initially used Ubuntu 20.04. Its signed Docker
repository currently provides Engine 28.1.1 and Compose 2.35.1. Ubuntu 20.04 is
outside standard support: plan a move to a supported Ubuntu LTS rather than
treating this recovery as an OS security upgrade.

References: [Docker resource controls](https://docs.docker.com/engine/containers/resource_constraints/),
[PostgreSQL memory settings](https://www.postgresql.org/docs/17/runtime-config-resource.html),
[PostgreSQL connections](https://www.postgresql.org/docs/17/runtime-config-connection.html).
