#!/bin/sh
set -e

# Les volumes (Railway, Render, bind mounts Docker) peuvent appartenir à root
# au premier montage. On prépare le dossier de données pour l'utilisateur node,
# puis on abandonne les privilèges avant de lancer l'application.
DATA_DIR="${KANBAN_DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec su-exec node "$@"
fi

exec "$@"
