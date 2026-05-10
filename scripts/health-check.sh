#!/usr/bin/env bash
# Quick sanity check for agents: verify deps, build, and list key outputs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Lavanda Game Health Check ==="
echo ""

echo "Node version: $(node --version)"
echo "NPM version:  $(npm --version)"
echo ""

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
else
  echo "Dependencies already installed."
fi
echo ""

echo "Running build..."
npm run build
echo ""

echo "Build outputs:"
ls -lh dist/
echo ""

echo "Key source files:"
ls -lh src/main.ts src/style.css index.html
echo ""

echo "Public assets:"
ls -lh public/
echo ""

echo "=== All good ==="
