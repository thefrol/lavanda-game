import './style.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

type Dir = 'up' | 'right' | 'down' | 'left'

const DIR_VEC: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}

const DIR_ORDER: Dir[] = ['up', 'right', 'down', 'left']

function opposite(a: Dir, b: Dir): boolean {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  )
}

/** Horizontal definition; playfield is transposed so the maze is tall on phones. */
const RAW_MAP_HORIZONTAL = [
  '###################',
  '#.................#',
  '#.###.#.#.#.###.#.#',
  '#.....G..G..G.....#',
  '#.###.#.#.#.###.#.#',
  '#.................#',
  '#.#.#..###..#.#.#.#',
  '#.#...#.#.#...#.#.#',
  '#...#..#P#..#...#.#',
  '#.#.##.....##.#.#.#',
  '#.................#',
  '###################',
] as const

function transposeMap(lines: readonly string[]): string[] {
  const h = lines.length
  const w = lines[0]?.length ?? 0
  const out: string[] = []
  for (let x = 0; x < w; x++) {
    let row = ''
    for (let y = 0; y < h; y++) {
      row += lines[y]?.[x] ?? '#'
    }
    out.push(row)
  }
  return out
}

const RAW_MAP = transposeMap(RAW_MAP_HORIZONTAL)

interface ParsedMap {
  width: number
  height: number
  wall: boolean[][]
  dot: boolean[][]
  player: { x: number; y: number }
  ghosts: { x: number; y: number }[]
}

function parseMap(lines: readonly string[]): ParsedMap {
  const height = lines.length
  const width = lines[0]?.length ?? 0
  const wall: boolean[][] = []
  const dot: boolean[][] = []
  let player = { x: 1, y: 1 }
  const ghosts: { x: number; y: number }[] = []

  for (let y = 0; y < height; y++) {
    wall[y] = []
    dot[y] = []
    const row = lines[y] ?? ''
    for (let x = 0; x < width; x++) {
      const c = row[x] ?? '#'
      if (c === 'P') {
        player = { x, y }
        wall[y][x] = false
        dot[y][x] = false
      } else if (c === 'G') {
        ghosts.push({ x, y })
        wall[y][x] = false
        dot[y][x] = false
      } else {
        wall[y][x] = c === '#'
        dot[y][x] = c === '.'
      }
    }
  }

  return { width, height, wall, dot, player, ghosts }
}

function inBounds(m: ParsedMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < m.width && y < m.height
}

function walkable(m: ParsedMap, x: number, y: number): boolean {
  return inBounds(m, x, y) && !m.wall[y][x]
}

function pickGhostMove(
  m: ParsedMap,
  g: { x: number; y: number },
  last: Dir | null,
  target: { x: number; y: number },
): Dir | null {
  const options: Dir[] = []
  for (const d of DIR_ORDER) {
    const { dx, dy } = DIR_VEC[d]
    if (last && opposite(last, d)) continue
    if (walkable(m, g.x + dx, g.y + dy)) options.push(d)
  }
  if (options.length === 0) {
    for (const d of DIR_ORDER) {
      const { dx, dy } = DIR_VEC[d]
      if (walkable(m, g.x + dx, g.y + dy)) options.push(d)
    }
  }
  if (options.length === 0) return null
  if (Math.random() < 0.28) return options[Math.floor(Math.random() * options.length)]

  let best: Dir = options[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const d of options) {
    const { dx, dy } = DIR_VEC[d]
    const nx = g.x + dx
    const ny = g.y + dy
    const score = Math.abs(nx - target.x) + Math.abs(ny - target.y)
    if (score < bestScore) {
      bestScore = score
      best = d
    } else if (score === bestScore && Math.random() < 0.5) {
      best = d
    }
  }
  return best
}

function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')
  const scoreEl = document.querySelector<HTMLSpanElement>('#score')
  const restartBtn = document.querySelector<HTMLButtonElement>('#restart')
  if (!canvas || !scoreEl || !restartBtn) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  boot(canvas, ctx, scoreEl, restartBtn)
}

function boot(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  scoreEl: HTMLSpanElement,
  restartBtn: HTMLButtonElement,
) {
  const map = parseMap(RAW_MAP)
  const hero = new Image()
  hero.decoding = 'async'
  hero.src = `${import.meta.env.BASE_URL}lavanda.png`

  let cell = 22
  let dpr = Math.min(window.devicePixelRatio ?? 1, 2)

  const state = {
    px: map.player.x,
    py: map.player.y,
    dir: null as Dir | null,
    queued: null as Dir | null,
    ghosts: map.ghosts.map((p) => ({ x: p.x, y: p.y })),
    ghostDir: map.ghosts.map(() => null as Dir | null),
    score: 0,
    alive: true,
    won: false,
    tick: 0,
  }

  function dotsLeft(): number {
    let n = 0
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.dot[y][x]) n++
      }
    }
    return n
  }

  function resize() {
    const padX = 20
    const padY = 16
    const belowCanvas = 112
    const availW = Math.max(120, window.innerWidth - padX)
    const availH = Math.max(160, window.innerHeight - padY - belowCanvas)
    const cw = Math.floor(availW / map.width)
    const ch = Math.floor(availH / map.height)
    const portrait = window.innerHeight >= window.innerWidth
    const cap = portrait ? 36 : 32
    cell = Math.min(cw, ch, cap)
    cell = Math.max(cell, 15)
    dpr = Math.min(window.devicePixelRatio ?? 1, 2)
    const w = map.width * cell
    const h = map.height * cell
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function tryStartMove(d: Dir) {
    if (!state.alive) return
    const { dx, dy } = DIR_VEC[d]
    if (walkable(map, state.px + dx, state.py + dy)) {
      state.dir = d
      state.queued = null
    } else {
      state.queued = d
    }
  }

  function stepPlayer() {
    if (!state.alive || state.won) return

    if (state.queued) {
      const { dx, dy } = DIR_VEC[state.queued]
      if (walkable(map, state.px + dx, state.py + dy)) {
        state.dir = state.queued
        state.queued = null
      }
    }

    if (!state.dir) return
    const { dx, dy } = DIR_VEC[state.dir]
    const nx = state.px + dx
    const ny = state.py + dy
    if (!walkable(map, nx, ny)) {
      state.dir = null
      return
    }
    state.px = nx
    state.py = ny
    if (map.dot[ny][nx]) {
      map.dot[ny][nx] = false
      state.score += 10
      scoreEl.textContent = String(state.score)
      if (dotsLeft() === 0) {
        state.won = true
        state.alive = false
        restartBtn.hidden = false
      }
    }
  }

  function stepGhosts() {
    if (!state.alive || state.won) return
    for (let i = 0; i < state.ghosts.length; i++) {
      const g = state.ghosts[i]
      const d = pickGhostMove(map, g, state.ghostDir[i], { x: state.px, y: state.py })
      if (!d) continue
      const { dx, dy } = DIR_VEC[d]
      state.ghostDir[i] = d
      g.x += dx
      g.y += dy
    }
    for (const g of state.ghosts) {
      if (g.x === state.px && g.y === state.py) {
        state.alive = false
        restartBtn.hidden = false
      }
    }
  }

  function draw() {
    const w = map.width * cell
    const h = map.height * cell
    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = '#e8e4f0'
    ctx.fillRect(0, 0, w, h)

    const pad = cell * 0.12
    ctx.fillStyle = '#5c5470'
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!map.wall[y][x]) continue
        ctx.beginPath()
        ctx.roundRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.22)
        ctx.fill()
      }
    }

    ctx.fillStyle = '#7c5a12'
    const r = Math.max(1.8, cell * 0.11)
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!map.dot[y][x]) continue
        ctx.beginPath()
        ctx.arc(x * cell + cell / 2, y * cell + cell / 2, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const gx = state.px * cell + cell / 2
    const gy = state.py * cell + cell / 2
    const heroMax = cell * 1.22
    let hw = heroMax
    let hh = heroMax
    if (hero.complete && hero.naturalWidth > 0) {
      const ar = hero.naturalWidth / hero.naturalHeight
      if (ar >= 1) {
        hw = heroMax
        hh = heroMax / ar
      } else {
        hh = heroMax
        hw = heroMax * ar
      }
    }
    if (hero.complete && hero.naturalWidth > 0) {
      ctx.drawImage(hero, gx - hw / 2, gy - hh / 2, hw, hh)
    } else {
      ctx.save()
      ctx.translate(gx, gy)
      const r0 = heroMax * 0.48
      ctx.fillStyle = '#4b5563'
      ctx.beginPath()
      ctx.ellipse(0, 0, r0 * 0.94, r0 * 0.9, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#e8e4f0'
      ctx.beginPath()
      ctx.arc(-r0 * 0.28, -r0 * 0.12, r0 * 0.14, 0, Math.PI * 2)
      ctx.arc(r0 * 0.28, -r0 * 0.12, r0 * 0.14, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const ghostColors = ['#c2415c', '#1d6fa5', '#0d8064']
    for (let i = 0; i < state.ghosts.length; i++) {
      const g = state.ghosts[i]
      const cx = g.x * cell + cell / 2
      const cy = g.y * cell + cell / 2
      const rr = cell * 0.44
      ctx.fillStyle = ghostColors[i % ghostColors.length]
      ctx.beginPath()
      ctx.arc(cx, cy - rr * 0.1, rr, Math.PI, 0)
      ctx.lineTo(cx + rr, cy + rr * 0.9)
      ctx.lineTo(cx + rr * 0.66, cy + rr * 0.55)
      ctx.lineTo(cx + rr * 0.33, cy + rr * 0.95)
      ctx.lineTo(cx, cy + rr * 0.55)
      ctx.lineTo(cx - rr * 0.33, cy + rr * 0.95)
      ctx.lineTo(cx - rr * 0.66, cy + rr * 0.55)
      ctx.lineTo(cx - rr, cy + rr * 0.9)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#faf8ff'
      ctx.beginPath()
      ctx.arc(cx - rr * 0.35, cy - rr * 0.05, rr * 0.18, 0, Math.PI * 2)
      ctx.arc(cx + rr * 0.35, cy - rr * 0.05, rr * 0.18, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1e1b2e'
      ctx.beginPath()
      ctx.arc(cx - rr * 0.32, cy - rr * 0.02, rr * 0.08, 0, Math.PI * 2)
      ctx.arc(cx + rr * 0.38, cy - rr * 0.02, rr * 0.08, 0, Math.PI * 2)
      ctx.fill()
    }

    if (!state.alive) {
      ctx.fillStyle = 'rgba(30, 27, 46, 0.55)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#faf8ff'
      ctx.font = `700 ${Math.max(16, cell * 0.9)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const msg = state.won ? 'Победа!' : 'Ой, призрак!'
      ctx.fillText(msg, w / 2, h / 2 - cell * 0.35)
      ctx.font = `500 ${Math.max(12, cell * 0.45)}px system-ui, sans-serif`
      ctx.fillText('Нажми «Перезапуск»', w / 2, h / 2 + cell * 0.55)
    }
  }

  function reset() {
    const fresh = parseMap(RAW_MAP)
    map.wall = fresh.wall
    map.dot = fresh.dot
    state.px = fresh.player.x
    state.py = fresh.player.y
    state.dir = null
    state.queued = null
    state.ghosts = fresh.ghosts.map((p) => ({ x: p.x, y: p.y }))
    state.ghostDir = fresh.ghosts.map(() => null)
    state.score = 0
    state.alive = true
    state.won = false
    state.tick = 0
    scoreEl.textContent = '0'
    restartBtn.hidden = true
  }

  restartBtn.addEventListener('click', () => {
    reset()
    draw()
  })

  window.addEventListener('keydown', (e) => {
    const k = e.key
    if (k === 'ArrowUp' || k === 'w' || k === 'W') tryStartMove('up')
    if (k === 'ArrowRight' || k === 'd' || k === 'D') tryStartMove('right')
    if (k === 'ArrowDown' || k === 's' || k === 'S') tryStartMove('down')
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') tryStartMove('left')
  })

  let touchOx = 0
  let touchOy = 0
  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return
      touchOx = e.touches[0].clientX
      touchOy = e.touches[0].clientY
    },
    { passive: true },
  )
  canvas.addEventListener(
    'touchend',
    (e) => {
      if (!e.changedTouches[0]) return
      const dx = e.changedTouches[0].clientX - touchOx
      const dy = e.changedTouches[0].clientY - touchOy
      const t = 28
      if (Math.abs(dx) < t && Math.abs(dy) < t) return
      if (Math.abs(dx) > Math.abs(dy)) tryStartMove(dx > 0 ? 'right' : 'left')
      else tryStartMove(dy > 0 ? 'down' : 'up')
    },
    { passive: true },
  )

  resize()
  window.addEventListener('resize', () => {
    resize()
    draw()
  })

  hero.addEventListener('load', draw)

  setInterval(() => {
    const playing = state.alive && !state.won
    if (playing) {
      state.tick++
      if (state.tick % 2 === 0) stepGhosts()
      stepPlayer()
    }
    draw()
  }, 150)

  draw()
}

main()
