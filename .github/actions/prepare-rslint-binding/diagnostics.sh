#!/usr/bin/env bash
# Sourced by the build step. Diagnostics must not change its exit status.
rslint_go_cache=$(go env GOCACHE 2>/dev/null || true)
rslint_go_modcache=$(go env GOMODCACHE 2>/dev/null || true)
rslint_go_tmp=$(go env GOTMPDIR 2>/dev/null || true)
rslint_go_tmp=${rslint_go_tmp:-${TMPDIR:-/tmp}}
rslint_pnpm_store=$(pnpm store path 2>/dev/null || true)

rslint_disk_snapshot() (
  set +e
  printf '\n::group::Rslint disk usage: %s (%s)\n' "$1" "$(date -u +%FT%TZ)"
  df -hT / /tmp "$PWD" "$rslint_go_tmp" "${RUNNER_TEMP:-/tmp}" "$rslint_go_cache" "$rslint_go_modcache"
  df -i / /tmp "$PWD" "$rslint_go_tmp" "${RUNNER_TEMP:-/tmp}" "$rslint_go_cache" "$rslint_go_modcache"
  free -h
  ps -eo pid,comm,rss,pcpu --sort=-rss | head -n 10

  paths=()
  for path in node_modules target npm/rslint \
    "$rslint_go_cache" "$rslint_go_modcache" "$rslint_pnpm_store" \
    "${CARGO_HOME:-$HOME/.cargo}" "$rslint_go_tmp"/go-build*; do
    if [[ -e "$path" ]]; then
      paths+=("$path")
    fi
  done
  if (( ${#paths[@]} )); then
    # Bound scans and tolerate Go removing temporary files during a sample.
    timeout 15s du -sh -- "${paths[@]}" 2>&1 || printf 'Directory scan incomplete (exit %s).\n' "$?"
  fi
  printf '::endgroup::\n'
  return 0
)

rslint_disk_monitor() {
  local sleeper=''
  trap 'if [[ -n "$sleeper" ]]; then kill "$sleeper" 2>/dev/null || true; wait "$sleeper" 2>/dev/null || true; fi; exit 0' TERM INT
  while true; do
    sleep 30 &
    sleeper=$!
    wait "$sleeper" || return 0
    sleeper=''
    # Go removes its work directory before an unsuccessful build returns.
    rslint_disk_snapshot 'during build'
  done
}

rslint_finish_diagnostics() {
  local status=$?
  trap - EXIT
  kill "$rslint_monitor_pid" 2>/dev/null || true
  wait "$rslint_monitor_pid" 2>/dev/null || true
  rslint_disk_snapshot "build exit (status $status)"
  exit "$status"
}

(
  set +e
  printf '::group::Rslint build environment\n'
  go version
  go env -json GOFLAGS GOTOOLCHAIN GOCACHE GOMODCACHE GOTMPDIR GOOS GOARCH
  printf 'GOMAXPROCS=%s GOMEMLIMIT=%s GOGC=%s\n' \
    "${GOMAXPROCS:-<unset>}" "${GOMEMLIMIT:-<unset>}" "${GOGC:-<unset>}"
  printf 'Available CPUs: '
  nproc
  for path in /tmp "$PWD" "$rslint_go_tmp" "$rslint_go_cache" "$rslint_go_modcache"; do
    if [[ -d "$path" ]]; then
      findmnt -T "$path" -o TARGET,SOURCE,FSTYPE,OPTIONS
    fi
  done
  if command -v quota >/dev/null 2>&1; then
    quota -sv
  else
    printf 'quota command unavailable; filesystem mount options are shown above.\n'
  fi
  printf 'Preinstalled runner tools (before building):\n'
  timeout 15s du -sh /opt/hostedtoolcache /usr/share/dotnet \
    /usr/local/lib/android /opt/ghc /usr/local/share/powershell 2>&1 \
    || printf 'Runner tools scan incomplete (exit %s).\n' "$?"
  printf '::endgroup::\n'
)
rslint_disk_snapshot 'before pnpm install'
rslint_disk_monitor &
rslint_monitor_pid=$!
trap rslint_finish_diagnostics EXIT
