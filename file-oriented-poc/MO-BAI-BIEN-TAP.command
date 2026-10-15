#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT=4173
URL="http://127.0.0.1:${PORT}/preview-static.html"

if ! lsof -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  nohup python3 -m http.server ${PORT} --bind 127.0.0.1 > /tmp/dkt-file-poc-http.log 2>&1 &
  sleep 1
fi

open -R CONTENT.md
open -a Safari "$URL"
