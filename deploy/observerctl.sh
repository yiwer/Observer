#!/bin/sh
set -eu
umask 077
deployment_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
environment_file=${OBSERVER_ENV_FILE:-/etc/observer/deployment.env}
compose() {
    docker compose --project-name observer --env-file "$environment_file" -f "$deployment_dir/compose.yaml" "$@"
}
case "${1:-}" in
    up) test "$#" -eq 1; compose up -d --wait --wait-timeout 90 ;;
    stop) test "$#" -eq 1; compose stop --timeout 40 ;;
    restart) test "$#" -eq 1; compose restart --timeout 40 app ;;
    state) test "$#" -eq 1; compose ps --all ;;
    status) test "$#" -eq 1; compose exec -T app node dist/ops-admin.js ;;
    logs) test "$#" -eq 1; compose logs --tail 100 app ;;
    devices) test "$#" -eq 1; compose exec -T app node dist/device-admin.js --database /var/lib/observer/observer.sqlite devices ;;
    pair) test "$#" -eq 1; compose exec -T app node dist/device-admin.js --database /var/lib/observer/observer.sqlite pair ;;
    revoke) test "$#" -eq 2; compose exec -T app node dist/device-admin.js --database /var/lib/observer/observer.sqlite revoke "$2" ;;
    retention-status) test "$#" -eq 1; compose exec -T app node dist/retention-admin.js --config /etc/observer/config/runtime.json status ;;
    agents)
        test "$#" -eq 1
        docker ps --all --filter label=observer.task --format '{{.ID}} {{.State}} {{.Image}} {{.Label "observer.node"}}'
        ;;
    agent-remove)
        test "$#" -eq 3
        # Exact caller-selected container + node; no broad prune or forced kill.
        test "${#2}" -eq 64
        case "$2" in *[!a-f0-9]*) exit 1 ;; esac
        case "$3" in ''|*[!a-z0-9-]*) exit 1 ;; esac
        test -z "$(compose ps --status running -q app)"
        metadata=$(docker inspect --format '{{.Id}}|{{index .Config.Labels "observer.node"}}|{{index .Config.Labels "observer.task"}}|{{.State.Status}}|{{.Created}}' "$2")
        case "$metadata" in "$2|$3|observer-"*'|exited|'*) ;; *) exit 1 ;; esac
        test "$metadata" = "$(docker inspect --format '{{.Id}}|{{index .Config.Labels "observer.node"}}|{{index .Config.Labels "observer.task"}}|{{.State.Status}}|{{.Created}}' "$2")"
        docker rm "$2"
        ;;
    *) printf '%s\n' 'Usage: observerctl up|stop|restart|state|status|logs|devices|pair|revoke <device-id>|retention-status|agents|agent-remove <full-container-id> <node-label>' >&2; exit 1 ;;
esac
