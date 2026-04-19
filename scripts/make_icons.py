#!/usr/bin/env python3
"""Ensure GitHub Pages helper files exist.

PWA app icons (favicon / apple-touch) are built from your dog photo — run:
  bash scripts/sync_pwa_icons.sh

In-game sprite: replace public/lavanda.png yourself (or copy from repo root lavanda.png).
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (PUBLIC / ".nojekyll").write_text("", encoding="utf-8")


if __name__ == "__main__":
    main()
