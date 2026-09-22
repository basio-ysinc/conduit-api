#!/usr/bin/env bash
# サーバを一時 DB で起動し、hurl の適合テストを回す。
# 引数にファイル名(auth.hurl など)を渡すとそれだけ、無ければ spec/enabled.txt に列挙されたファイルを回す。
set -euo pipefail
cd "$(dirname "$0")/.."
FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
  while IFS= read -r line; do
    line="${line%%#*}"; line="$(echo "$line" | xargs || true)"
    [ -n "$line" ] && FILES+=("$line")
  done < spec/enabled.txt
fi
if [ ${#FILES[@]} -eq 0 ]; then
  echo "no hurl files enabled (spec/enabled.txt is empty); nothing to run"
  exit 0
fi
command -v hurl >/dev/null || { echo "hurl is not installed (brew install hurl)"; exit 1; }
pnpm build >/dev/null
PORT="${PORT:-3100}"
TMP="$(mktemp -d)"; trap '{ kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null; } || true; rm -rf "$TMP"' EXIT
PORT="$PORT" DATABASE_PATH="$TMP/test.db" JWT_SECRET="${JWT_SECRET:-test-secret}" node dist/index.js >"$TMP/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 50); do
  curl -sf "http://localhost:$PORT/api/health" >/dev/null && break
  sleep 0.2
done
curl -sf "http://localhost:$PORT/api/health" >/dev/null || { echo "server did not start"; cat "$TMP/server.log"; exit 1; }
PATHS=()
for f in "${FILES[@]}"; do PATHS+=("spec/hurl/$f"); done
HOST="http://localhost:$PORT" ./spec/run-api-tests-hurl.sh "${PATHS[@]}"
