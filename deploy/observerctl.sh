#!/bin/sh
set -eu
umask 077
deployment_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
environment_file=${OBSERVER_ENV_FILE:-/etc/observer/deployment.env}
case "${1:-}" in
    up|stop|restart|backup|backup-tick|restore|complete-drill)
        if test "${OBSERVER_CONTROL_LOCKED:-0}" != 1; then
            exec flock --exclusive --nonblock /run/lock/observer-control.lock env OBSERVER_CONTROL_LOCKED=1 "$0" "$@"
        fi
        ;;
esac
compose() {
    docker compose --project-name observer --env-file "$environment_file" -f "$deployment_dir/compose.yaml" "$@"
}
backup_command() {
    docker compose --project-name observer --env-file "$environment_file" -f "$deployment_dir/compose.yaml" -f "$deployment_dir/backup.compose.yaml" \
        --profile backup run --rm -T backup --config /etc/observer/backup/config.json "$@"
}
run_backup() {
    resume_app=$(compose ps --status running -q app)
    if test -n "$resume_app"; then compose stop --timeout 40 app; fi
    # Resume only an app which this invocation stopped, after backup releases its
    # data lock. A machine crash may require an explicit retry/up by the operator.
    resume_backup_app() { if test -n "$resume_app"; then compose up -d --no-deps --wait --wait-timeout 90 app; fi; }
    trap resume_backup_app EXIT
    backup_exit=0
    backup_command create || backup_exit=$?
    resume_backup_app
    trap - EXIT
    return "$backup_exit"
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
    backup-status) test "$#" -eq 1; backup_command status ;;
    backup) test "$#" -eq 1; run_backup ;;
    backup-tick)
        test "$#" -eq 1
        # An operator's stopped service remains stopped. Missed RPO is visible in
        # persisted status; timer enablement alone does not start the service.
        test -n "$(compose ps --status running -q app)" || exit 0
        due_exit=0
        backup_command due || due_exit=$?
        case "$due_exit" in 0) ;; 10) run_backup ;; *) exit "$due_exit" ;; esac
        ;;
    restore) test "$#" -eq 3; backup_command restore "$2" "$3" ;;
    complete-drill) test "$#" -eq 4; backup_command complete-drill "$2" "$3" "$4" ;;
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
    *) printf '%s\n' 'Usage: observerctl up|stop|restart|state|status|logs|devices|pair|revoke <device-id>|retention-status|backup-status|backup|backup-tick|restore <new-id> <incident-utc>|complete-drill <id> <private-url> <owner-token-file>|agents|agent-remove <full-container-id> <node-label>' >&2; exit 1 ;;
esac
