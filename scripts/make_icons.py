#!/usr/bin/env python3
"""Write PWA icons into public/ (stdlib only).

In-game hero is public/lavanda.png — put your dog photo there (this script does not overwrite it).
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, rgba: bytes) -> None:
    assert len(rgba) == width * height * 4
    raw = b""
    for y in range(height):
        raw += b"\x00" + rgba[y * width * 4 : (y + 1) * width * 4]
    compressed = zlib.compress(raw, level=9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    path.write_bytes(png)


def fill_rounded(w: int, h: int, bg: tuple[int, int, int, int], fg: tuple[int, int, int, int]) -> bytes:
    cx, cy = w / 2, h / 2
    r = min(w, h) * 0.36
    out = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy <= r * r:
                out[(y * w + x) * 4 : (y * w + x) * 4 + 4] = bytes(fg)
            else:
                out[(y * w + x) * 4 : (y * w + x) * 4 + 4] = bytes(bg)
    return bytes(out)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    lavender = (183, 148, 246, 255)
    deep = (45, 27, 78, 255)
    # App icons (lavender circle on deep bg)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        write_png(PUBLIC / name, size, size, fill_rounded(size, size, deep, lavender))

    # Tiny nose on apple-touch (two white pixels band as "snout" — optional simple mark)
    # Keep icons clean; skip extra detail.

    (PUBLIC / ".nojekyll").write_text("", encoding="utf-8")


if __name__ == "__main__":
    main()
