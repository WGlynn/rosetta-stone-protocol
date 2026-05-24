#!/usr/bin/env bash
#
# Rosetta Stone Protocol — Installer
# ===================================
# Sets up a working local instance of the Rosetta Stone Protocol monorepo.
# Works on macOS, Linux, and Windows (Git Bash / WSL).
#
# What this does:
#   1. Runs `npm install` at the repo root (installs all workspaces)
#   2. Creates the SQLite database file (server initializes schema on first boot)
#   3. Optionally seeds the lexicon registry with example lexicons from ./lexicons/
#
# What this does NOT do:
#   - Does not configure on-chain attribution (PrimitiveRegistry / ShapleyDistributor
#     binding is a separate step — see README, "On-chain attribution")
#   - Does not deploy. This is a local-first install for development + contribution.
#
# Args:
#   --server-port N    Set the server port (default: 4242)
#   --db-path PATH     Set the SQLite DB path (default: packages/server/rosetta.sqlite)
#   --seed             Seed the registry with any *.json files in ./lexicons/
#   --dry-run          Print the plan without executing
#   -h | --help        Show this help

set -e

# ============ Defaults ============

SERVER_PORT=4242
REPO_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DB_PATH="$REPO_DIR/packages/server/rosetta.sqlite"
SEED=0
DRY_RUN=0

# ============ Arg parsing ============

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-port) SERVER_PORT="$2"; shift 2 ;;
    --db-path)     DB_PATH="$2"; shift 2 ;;
    --seed)        SEED=1; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)     sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ============ Plan ============

echo
echo "Rosetta Stone Protocol — Installer"
echo "===================================="
echo
echo "Installation plan:"
echo "  Repo root      : $REPO_DIR"
echo "  Server port    : $SERVER_PORT"
echo "  DB path        : $DB_PATH"
echo "  Seed lexicons  : $SEED"
echo "  Dry-run        : $DRY_RUN"
echo

# ============ Helpers ============

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [dry] $*"
  else
    echo "  >> $*"
    eval "$@"
  fi
}

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required binary '$1' not on PATH. Install it and re-run."
    exit 1
  fi
}

# ============ Preflight ============

echo "Preflight checks..."
require_bin node
require_bin npm
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "ERROR: Node 18+ required (better-sqlite3 + native fetch). Found: $(node -v)"
  exit 1
fi
echo "  node: $(node -v) ✓"
echo "  npm:  $(npm -v) ✓"

# ============ Install deps ============

echo
echo "Installing dependencies (npm workspaces)..."
cd "$REPO_DIR"
run_cmd "npm install"

# ============ DB bootstrap ============

DB_DIR="$( dirname "$DB_PATH" )"
echo
echo "Bootstrapping SQLite database..."
if [[ "$DRY_RUN" == "1" ]]; then
  echo "  [dry] mkdir -p $DB_DIR"
  echo "  [dry] DB schema will be created on first server boot via server.js"
else
  mkdir -p "$DB_DIR"
  # Server creates the schema lazily on first boot via better-sqlite3 .exec().
  # We just touch the file path so the user sees where it lives.
  touch "$DB_PATH"
  echo "  DB file at: $DB_PATH"
  echo "  (schema will materialize on first \`npm run dev:server\`)"
fi

# ============ Seed (optional) ============

if [[ "$SEED" == "1" ]]; then
  echo
  echo "Seeding lexicons from ./lexicons/*.json ..."

  LEX_FILES=$(ls "$REPO_DIR"/lexicons/*.json 2>/dev/null || true)
  if [[ -z "$LEX_FILES" ]]; then
    echo "  (no .json files in $REPO_DIR/lexicons — skipping)"
  else
    if [[ "$DRY_RUN" == "1" ]]; then
      for f in $LEX_FILES; do echo "  [dry] would POST $(basename "$f") -> http://localhost:$SERVER_PORT/lexicons"; done
    else
      # Boot server in background, POST each lexicon, then kill.
      echo "  Booting server in background on :$SERVER_PORT for seed..."
      ROSETTA_DB="$DB_PATH" PORT="$SERVER_PORT" \
        node "$REPO_DIR/packages/server/src/server.js" >"$REPO_DIR/.seed.log" 2>&1 &
      SERVER_PID=$!
      # Wait for /health
      for i in 1 2 3 4 5 6 7 8 9 10; do
        if curl -fs "http://localhost:$SERVER_PORT/health" >/dev/null 2>&1; then break; fi
        sleep 0.5
      done
      for f in $LEX_FILES; do
        echo "  seeding: $(basename "$f")"
        curl -fs -X POST "http://localhost:$SERVER_PORT/lexicons" \
          -H 'Content-Type: application/json' \
          --data-binary "@$f" >/dev/null || echo "    (failed — check $REPO_DIR/.seed.log)"
      done
      kill "$SERVER_PID" 2>/dev/null || true
      wait "$SERVER_PID" 2>/dev/null || true
      rm -f "$REPO_DIR/.seed.log"
      echo "  Seed complete."
    fi
  fi
fi

# ============ Done ============

echo
echo "============================================================"
echo "  Rosetta Stone Protocol installed."
echo "============================================================"
echo
echo "  Start the server:"
echo "    PORT=$SERVER_PORT ROSETTA_DB=$DB_PATH npm run dev:server"
echo
echo "  Start the web demo:"
echo "    npm run dev:web   # http://localhost:3001"
echo
echo "  Smoke test:"
echo "    curl http://localhost:$SERVER_PORT/health"
echo
echo "  API: see README.md (Routes section)."
echo "  On-chain attribution: see README.md (Integration points)."
echo
