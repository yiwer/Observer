#!/bin/sh
set -eu
umask 077
deployment_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
environment_file=${OBSERVER_ENV_FILE:-/etc/observer/deployment.env}
compose() {
    docker compose --project-name observer --env-file "$environment_file" -f "$deployment_dir/compose.yaml" "$@"
}
# A stopped app is intentional or has exhausted its crash restart budget.
# Only a running container whose liveness check failed is restarted here.
container=$(compose ps --status running -q app)
test -n "$container" || exit 0
state=$(docker inspect --format '{{.Id}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Health.Status}}' "$container")
case "$state" in *'|observer|app|unhealthy') ;; *) exit 0 ;; esac
state_directory=/run/observer-watchdog
mkdir -p "$state_directory"
exec 9>"$state_directory/lock"
flock -n 9 || exit 0
now=$(date +%s)
since=$now
count=0
if test -f "$state_directory/budget"; then read -r since count < "$state_directory/budget"; fi
case "$since:$count" in *[!0-9:]*|:*) exit 1 ;; esac
if test "$((now - since))" -ge 3600; then since=$now; count=0; fi
if test "$count" -ge 3; then printf '%s\n' 'observer-watchdog-restart-budget-exhausted' >&2; exit 0; fi
# Read back the exact ID and its labels/health immediately before restarting.
test "$state" = "$(docker inspect --format '{{.Id}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Health.Status}}' "$container")" || exit 0
printf '%s %s\n' "$since" "$((count + 1))" > "$state_directory/budget"
docker restart --time 40 "$container" >/dev/null
printf '%s\n' 'observer-watchdog-restarted-unhealthy-app'
