#!/usr/bin/env bash
# conduit-spec から契約(openapi / hurl)を取り込む。SPEC_DIR で場所を指定(既定 ../conduit-spec)。
set -euo pipefail
cd "$(dirname "$0")/.."
SPEC_DIR="${SPEC_DIR:-../conduit-spec}"
[ -f "$SPEC_DIR/api/openapi.yml" ] || { echo "conduit-spec not found at $SPEC_DIR (set SPEC_DIR)"; exit 1; }
rm -rf spec/hurl
mkdir -p spec
cp "$SPEC_DIR/api/openapi.yml" "$SPEC_DIR/api/run-api-tests-hurl.sh" spec/
cp -R "$SPEC_DIR/api/hurl" spec/hurl
cp "$SPEC_DIR/UPSTREAM.lock" spec/UPSTREAM.lock
chmod +x spec/run-api-tests-hurl.sh spec/hurl/run-hurl-tests.sh
echo "synced spec from $SPEC_DIR"
