#!/bin/sh
set -e
trap 'kill $pid_web $pid_docs $pid_api 2>/dev/null; wait' TERM INT

( cd /services/web && HOSTNAME=0.0.0.0 PORT="${WEB_PORT:-3000}" exec node apps/web/server.js ) &
pid_web=$!

( cd /services/docs && HOSTNAME=0.0.0.0 PORT="${DOCS_PORT:-6969}" exec node apps/docs/server.js ) &
pid_docs=$!

( cd /services/api && exec node dist/index.mjs ) &
pid_api=$!

wait
