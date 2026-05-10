# Agent Guide — Лаванда Game

## Quick Overview

**Лаванда** is a Pac-Man–style browser PWA. The player (a dog named Лаванда) collects treats (`poop.png`) around a maze while avoiding ghosts (Ольба). Built with Vite + TypeScript, deployed to GitHub Pages.

- **Repo**: `https://github.com/thefrol/lavanda-game`
- **Live game**: `https://thefrol.github.io/lavanda-game/`
- **Local clone**: `/Users/thefrol/Dimba/lavanda-game`

> **Note for agents**: `multica repo checkout` currently fails with "configured but not synced". Work directly in the existing clone at `/Users/thefrol/Dimba/lavanda-game` (branch `main`, remotes already point to HTTPS).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Build tool | Vite 6 |
| Language | TypeScript (~5.7) |
| Rendering | HTML5 Canvas 2D |
| PWA | `vite-plugin-pwa` |
| Deploy | GitHub Actions → GitHub Pages |

## Local Development

```bash
cd /Users/thefrol/Dimba/lavanda-game
npm install
npm run dev      # Vite dev server
npm run build    # Outputs to dist/
npm run preview  # Preview the production build
```

## Build & Deploy

- `base` in `vite.config.ts` is `/lavanda-game/` — must match the GitHub repo name.
- Push to `main` triggers `.github/workflows/deploy-pages.yml`.
- The workflow builds `dist/` and publishes it via GitHub Actions Pages (not branch-based).

## Game Architecture

All game logic lives in a single file:

- **`src/main.ts`** — map parsing, game state, movement, collision, AI, rendering, input handling.
- **`src/style.css`** — layout, HUD, responsive safe-area padding.
- **`index.html`** — canvas + HUD markup, PWA meta tags.

### State Object

```ts
{
  px, py,           // player grid position
  dir, queued,      // current & queued movement direction
  ghosts[],         // ghost positions
  ghostDir[],       // last direction each ghost moved
  score, alive, won,
  tick,             // increments every 150 ms
}
```

### Tick Loop (150 ms)

- Every tick: `stepPlayer()` + `draw()`
- Every 2nd tick: `stepGhosts()`
- Ghosts use shortest-path (Manhattan distance) toward player with 28 % randomness.

### Map

ASCII grid in `src/main.ts` (`RAW_MAP_HORIZONTAL`), transposed at runtime so the maze is tall (phone-friendly).

- `#` = wall
- `.` = treat
- `P` = player start
- `G` = ghost start

### Controls

- Desktop: arrow keys or WASD
- Mobile: swipe gestures on the canvas

### Assets

| Asset | Source File | Used As |
|-------|-------------|---------|
| Hero (dog) | `public/lavanda_zoomed.png` | player sprite |
| Ghost (wife) | `public/olba.png` | enemy sprite |
| Treat | `public/poop.png` | collectible sprite |
| PWA icons | `public/icon-{192,512}.png`, `apple-touch-icon.png` | home-screen icons |

Regenerate PWA icons from the root `lavanda.png`:

```bash
npm run icons
# or: bash scripts/sync_pwa_icons.sh /path/to/photo.png
```

## Common Tasks

| Task | Command / File |
|------|----------------|
| Change map layout | Edit `RAW_MAP_HORIZONTAL` in `src/main.ts` |
| Adjust ghost AI | Modify `pickGhostMove()` in `src/main.ts` |
| Change tick speed | Edit the `setInterval(..., 150)` value in `src/main.ts` |
| Update sprites | Replace files in `public/` (keep same names) |
| Regenerate icons | `npm run icons` |
| Verify build | `npm run build` → check `dist/` contents |

## Known Quirks

- iOS aggressively caches `apple-touch-icon`. The build adds a `?v=` query param based on `GITHUB_RUN_NUMBER` or package version to bust the cache.
- `dist/` is gitignored and rebuilt by CI on every push — don't manually edit `dist/` files.
- Old `public/lavanda.png` exists but is not referenced in code; the active hero sprite is `public/lavanda_zoomed.png`.
