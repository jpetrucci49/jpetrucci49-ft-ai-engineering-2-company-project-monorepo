#!/bin/sh
set -eu

website_pid=""
backoffice_pid=""

shutdown() {
  if [ -n "$website_pid" ]; then
    kill "$website_pid" 2>/dev/null || true
  fi
  if [ -n "$backoffice_pid" ]; then
    kill "$backoffice_pid" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap shutdown INT TERM

if [ ! -x /app/website/node_modules/.bin/next ]; then
  echo "Installing website dependencies into the container volume..."
  (cd /app/website && npm install)
fi

if [ ! -x /app/backoffice/node_modules/.bin/next ]; then
  echo "Installing backoffice dependencies into the container volume..."
  (cd /app/backoffice && npm install)
fi

cd /app/website
npm run dev -- --port 3000 --hostname 0.0.0.0 &
website_pid=$!

cd /app/backoffice
npm run dev -- --port 3001 --hostname 0.0.0.0 &
backoffice_pid=$!

wait "$website_pid" "$backoffice_pid"
