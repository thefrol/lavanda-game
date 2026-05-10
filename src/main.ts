import './style.css'
import { registerSW } from 'virtual:pwa-register'
import Phaser from 'phaser'

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
  '########.##########',
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

interface Tunnel {
  x: number
  y: number
  dir: Dir
  toX: number
  toY: number
}

const TUNNELS: Tunnel[] = [
  { x: 0, y: 8, dir: 'left', toX: 10, toY: 8 },
  { x: 10, y: 8, dir: 'right', toX: 0, toY: 8 },
]

function getTunnel(x: number, y: number, dir: Dir): Tunnel | undefined {
  return TUNNELS.find((t) => t.x === x && t.y === y && t.dir === dir)
}

function isTunnelExit(x: number, y: number, dir: Dir): boolean {
  return TUNNELS.some((t) => t.x === x && t.y === y && t.dir === dir)
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
    if (isTunnelExit(g.x, g.y, d) || walkable(m, g.x + dx, g.y + dy)) options.push(d)
  }
  if (options.length === 0) {
    for (const d of DIR_ORDER) {
      const { dx, dy } = DIR_VEC[d]
      if (isTunnelExit(g.x, g.y, d) || walkable(m, g.x + dx, g.y + dy)) options.push(d)
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

class GameScene extends Phaser.Scene {
  private map!: ParsedMap
  private cellSize = 22

  private player!: Phaser.GameObjects.Sprite
  private ghostStates: {
    gridX: number
    gridY: number
    fromX: number
    fromY: number
    dir: Dir | null
    isMoving: boolean
    sprite: Phaser.GameObjects.Sprite
  }[] = []

  private dotGroup!: Phaser.GameObjects.Group
  private wallGraphics!: Phaser.GameObjects.Graphics
  private overlayGraphics!: Phaser.GameObjects.Graphics
  private overlayTextMain!: Phaser.GameObjects.Text
  private overlayTextSub!: Phaser.GameObjects.Text

  private score = 0
  private alive = true
  private won = false

  // Player movement
  private playerGrid = { x: 0, y: 0 }
  private playerFromX = 0
  private playerFromY = 0
  private playerDir: Dir | null = null
  private queuedDir: Dir | null = null
  private isPlayerMoving = false

  // Timing
  private readonly playerMoveDuration = 140
  private readonly ghostMoveDuration = 280
  // Input
  private keys!: Record<string, Phaser.Input.Keyboard.Key>

  // DOM
  private restartBtn!: HTMLButtonElement
  private scoreEl!: HTMLSpanElement

  constructor() {
    super({ key: 'GameScene' })
  }

  preload() {
    const base = import.meta.env.BASE_URL
    this.load.image('hero', `${base}lavanda_zoomed.png`)
    this.load.image('treat', `${base}poop.png`)
    this.load.image('ghost', `${base}olba.png`)
  }

  create() {
    this.map = parseMap(RAW_MAP)
    for (const t of TUNNELS) {
      if (inBounds(this.map, t.x, t.y)) {
        this.map.dot[t.y][t.x] = false
      }
    }
    this.restartBtn = document.getElementById('restart') as HTMLButtonElement
    this.scoreEl = document.getElementById('score') as HTMLSpanElement
    this.restartBtn.hidden = true
    this.restartBtn.onclick = () => this.reset()

    this.calculateCellSize()
    this.setGameSize()

    // Background
    this.add.rectangle(
      (this.map.width * this.cellSize) / 2,
      (this.map.height * this.cellSize) / 2,
      this.map.width * this.cellSize,
      this.map.height * this.cellSize,
      0xe8e4f0,
    )

    // Walls
    this.wallGraphics = this.add.graphics()
    this.drawWalls()

    // Dots
    this.dotGroup = this.add.group()
    this.createDots()

    // Player
    this.playerGrid = { ...this.map.player }
    const px = this.map.player.x * this.cellSize + this.cellSize / 2
    const py = this.map.player.y * this.cellSize + this.cellSize / 2
    this.player = this.add.sprite(px, py, 'hero')
    this.setHeroSize()

    // Ghosts
    this.ghostStates = []
    for (let i = 0; i < this.map.ghosts.length; i++) {
      const g = this.map.ghosts[i]
      const gx = g.x * this.cellSize + this.cellSize / 2
      const gy = g.y * this.cellSize + this.cellSize / 2
      const sprite = this.add.sprite(gx, gy, 'ghost')
      this.setGhostSize(sprite)
      this.ghostStates.push({
        gridX: g.x,
        gridY: g.y,
        fromX: g.x,
        fromY: g.y,
        dir: null,
        isMoving: false,
        sprite,
      })
    }

    // Overlay
    this.overlayGraphics = this.add.graphics()
    this.overlayTextMain = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      color: '#faf8ff',
      fontStyle: 'bold',
    })
    this.overlayTextMain.setOrigin(0.5)
    this.overlayTextSub = this.add.text(0, 0, 'Нажми «Перезапуск»', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      color: '#faf8ff',
      fontStyle: 'normal',
    })
    this.overlayTextSub.setOrigin(0.5)
    this.hideOverlay()

    // Keyboard
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT',
    ) as Record<string, Phaser.Input.Keyboard.Key>

    // Touch / swipe
    let touchOx = 0
    let touchOy = 0
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer) => {
        touchOx = pointer.x
        touchOy = pointer.y
      },
      this,
    )
    this.input.on(
      'pointerup',
      (pointer: Phaser.Input.Pointer) => {
        const dx = pointer.x - touchOx
        const dy = pointer.y - touchOy
        const t = 28
        if (Math.abs(dx) < t && Math.abs(dy) < t) return
        if (Math.abs(dx) > Math.abs(dy)) this.tryQueue(dx > 0 ? 'right' : 'left')
        else this.tryQueue(dy > 0 ? 'down' : 'up')
      },
      this,
    )

    // Ghost step timer
    this.time.addEvent({
      delay: this.ghostMoveDuration,
      callback: this.stepGhosts,
      callbackScope: this,
      loop: true,
    })

    // Window resize
    window.addEventListener('resize', () => this.handleResize())
  }

  // ---------- sizing ----------

  private calculateCellSize() {
    const padX = 20
    const padY = 16
    const belowCanvas = 112
    const availW = Math.max(120, window.innerWidth - padX)
    const availH = Math.max(160, window.innerHeight - padY - belowCanvas)
    const cw = Math.floor(availW / this.map.width)
    const ch = Math.floor(availH / this.map.height)
    const portrait = window.innerHeight >= window.innerWidth
    const cap = portrait ? 36 : 32
    this.cellSize = Math.min(cw, ch, cap)
    this.cellSize = Math.max(this.cellSize, 15)
  }

  private setGameSize() {
    const w = this.map.width * this.cellSize
    const h = this.map.height * this.cellSize
    this.scale.setGameSize(w, h)
  }

  private handleResize() {
    this.tweens.killAll()
    this.isPlayerMoving = false
    for (const gs of this.ghostStates) gs.isMoving = false

    this.calculateCellSize()
    this.setGameSize()
    this.drawWalls()
    this.repositionDots()
    this.repositionEntities()
    this.updateOverlay()
  }

  // ---------- rendering helpers ----------

  private drawWalls() {
    this.wallGraphics.clear()
    const pad = this.cellSize * 0.12
    this.wallGraphics.fillStyle(0x5c5470)
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.map.wall[y][x]) continue
        const rx = x * this.cellSize + pad
        const ry = y * this.cellSize + pad
        const rw = this.cellSize - pad * 2
        const rh = this.cellSize - pad * 2
        this.wallGraphics.fillRoundedRect(rx, ry, rw, rh, this.cellSize * 0.22)
      }
    }
  }

  private createDots() {
    this.dotGroup.clear(true, true)
    const treatMax = this.cellSize * 0.52
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.map.dot[y][x]) continue
        const cx = x * this.cellSize + this.cellSize / 2
        const cy = y * this.cellSize + this.cellSize / 2
        const dot = this.add.sprite(cx, cy, 'treat')
        dot.setDisplaySize(treatMax, treatMax)
        dot.setData('gridX', x)
        dot.setData('gridY', y)
        this.dotGroup.add(dot)
      }
    }
  }

  private repositionDots() {
    this.dotGroup.clear(true, true)
    this.createDots()
  }

  private setHeroSize() {
    const heroMax = this.cellSize * 1.22
    const tex = this.textures.get('hero')
    const frame = tex.getSourceImage() as HTMLImageElement
    if (!frame || frame.width === 0) {
      this.player.setDisplaySize(heroMax, heroMax)
      return
    }
    const ar = frame.width / frame.height
    let w = heroMax
    let h = heroMax
    if (ar >= 1) {
      w = heroMax
      h = heroMax / ar
    } else {
      h = heroMax
      w = heroMax * ar
    }
    this.player.setDisplaySize(w, h)
  }

  private setGhostSize(sprite: Phaser.GameObjects.Sprite) {
    const ghostMax = this.cellSize * 1.02
    const tex = this.textures.get('ghost')
    const frame = tex.getSourceImage() as HTMLImageElement
    if (!frame || frame.width === 0) {
      sprite.setDisplaySize(ghostMax, ghostMax)
      return
    }
    const ar = frame.width / frame.height
    let w = ghostMax
    let h = ghostMax
    if (ar >= 1) {
      w = ghostMax
      h = ghostMax / ar
    } else {
      h = ghostMax
      w = ghostMax * ar
    }
    sprite.setDisplaySize(w, h)
  }

  private repositionEntities() {
    const px = this.playerGrid.x * this.cellSize + this.cellSize / 2
    const py = this.playerGrid.y * this.cellSize + this.cellSize / 2
    this.player.setPosition(px, py)
    this.setHeroSize()

    for (const gs of this.ghostStates) {
      const gx = gs.gridX * this.cellSize + this.cellSize / 2
      const gy = gs.gridY * this.cellSize + this.cellSize / 2
      gs.sprite.setPosition(gx, gy)
      this.setGhostSize(gs.sprite)
    }
  }

  // ---------- overlay ----------

  private showOverlay() {
    const w = this.map.width * this.cellSize
    const h = this.map.height * this.cellSize

    this.overlayGraphics.clear()
    this.overlayGraphics.fillStyle(0x1e1b2e, 0.55)
    this.overlayGraphics.fillRect(0, 0, w, h)

    const msg = this.won ? 'Победа!' : 'Ой, Ольба!'
    this.overlayTextMain.setText(msg)
    this.overlayTextMain.setFontSize(Math.max(16, this.cellSize * 0.9))
    this.overlayTextMain.setPosition(w / 2, h / 2 - this.cellSize * 0.35)

    this.overlayTextSub.setFontSize(Math.max(12, this.cellSize * 0.45))
    this.overlayTextSub.setPosition(w / 2, h / 2 + this.cellSize * 0.55)

    this.overlayGraphics.setVisible(true)
    this.overlayTextMain.setVisible(true)
    this.overlayTextSub.setVisible(true)
  }

  private hideOverlay() {
    this.overlayGraphics.setVisible(false)
    this.overlayTextMain.setVisible(false)
    this.overlayTextSub.setVisible(false)
  }

  private updateOverlay() {
    if (!this.alive) this.showOverlay()
  }

  // ---------- game logic ----------

  private tryQueue(d: Dir) {
    if (!this.alive || this.won) return

    // If stopped, try to start immediately
    if (!this.playerDir && !this.isPlayerMoving) {
      const { dx, dy } = DIR_VEC[d]
      if (walkable(this.map, this.playerGrid.x + dx, this.playerGrid.y + dy) || isTunnelExit(this.playerGrid.x, this.playerGrid.y, d)) {
        this.playerDir = d
        this.startPlayerMove()
      } else {
        this.queuedDir = d
      }
      return
    }

    this.queuedDir = d
  }

  private startPlayerMove() {
    if (!this.playerDir || this.isPlayerMoving || !this.alive || this.won) return

    const tunnel = getTunnel(this.playerGrid.x, this.playerGrid.y, this.playerDir)
    if (tunnel) {
      this.playerGrid.x = tunnel.toX
      this.playerGrid.y = tunnel.toY
      this.player.setPosition(
        tunnel.toX * this.cellSize + this.cellSize / 2,
        tunnel.toY * this.cellSize + this.cellSize / 2,
      )
      this.onPlayerReachedCell(tunnel.toX, tunnel.toY)
      if (this.playerDir) {
        this.startPlayerMove()
      }
      return
    }

    const { dx, dy } = DIR_VEC[this.playerDir]
    const nx = this.playerGrid.x + dx
    const ny = this.playerGrid.y + dy

    if (!walkable(this.map, nx, ny)) {
      this.playerDir = null
      this.tryApplyQueuedDir()
      return
    }

    this.isPlayerMoving = true
    this.playerFromX = this.playerGrid.x
    this.playerFromY = this.playerGrid.y
    this.playerGrid.x = nx
    this.playerGrid.y = ny

    // Check crossing with a moving ghost (swap-through)
    for (const gs of this.ghostStates) {
      if (
        gs.isMoving &&
        gs.fromX === nx &&
        gs.fromY === ny &&
        gs.gridX === this.playerFromX &&
        gs.gridY === this.playerFromY
      ) {
        this.die()
        return
      }
    }

    const targetX = nx * this.cellSize + this.cellSize / 2
    const targetY = ny * this.cellSize + this.cellSize / 2

    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: this.playerMoveDuration,
      ease: 'Linear',
      onComplete: () => {
        this.isPlayerMoving = false
        this.onPlayerReachedCell(nx, ny)
        if (this.playerDir) {
          this.startPlayerMove()
        }
      },
    })
  }

  private tryApplyQueuedDir() {
    if (!this.queuedDir) return
    const { dx, dy } = DIR_VEC[this.queuedDir]
    if (walkable(this.map, this.playerGrid.x + dx, this.playerGrid.y + dy) || isTunnelExit(this.playerGrid.x, this.playerGrid.y, this.queuedDir)) {
      this.playerDir = this.queuedDir
      this.queuedDir = null
      this.startPlayerMove()
    }
  }

  private onPlayerReachedCell(x: number, y: number) {
    // Apply queued turn if possible
    if (this.queuedDir) {
      const { dx, dy } = DIR_VEC[this.queuedDir]
      if (walkable(this.map, x + dx, y + dy) || isTunnelExit(x, y, this.queuedDir)) {
        this.playerDir = this.queuedDir
        this.queuedDir = null
      }
    }

    // Collect dot
    if (this.map.dot[y][x]) {
      this.map.dot[y][x] = false
      this.score += 10
      this.scoreEl.textContent = String(this.score)

      const dots = this.dotGroup.getChildren() as Phaser.GameObjects.Sprite[]
      for (const dot of dots) {
        if (dot.getData('gridX') === x && dot.getData('gridY') === y) {
          // Pop animation then destroy
          this.tweens.add({
            targets: dot,
            scale: 1.6,
            alpha: 0,
            duration: 120,
            onComplete: () => dot.destroy(),
          })
          break
        }
      }

      if (this.dotsLeft() === 0) {
        this.won = true
        this.alive = false
        this.playerDir = null
        this.restartBtn.hidden = false
        this.showOverlay()
      }
    }

    this.checkGhostCollision()
  }

  private dotsLeft(): number {
    let n = 0
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.dot[y][x]) n++
      }
    }
    return n
  }

  private stepGhosts() {
    if (!this.alive || this.won) return

    for (let i = 0; i < this.ghostStates.length; i++) {
      const gs = this.ghostStates[i]
      if (gs.isMoving) continue

      const d = pickGhostMove(
        this.map,
        { x: gs.gridX, y: gs.gridY },
        gs.dir,
        { x: this.playerGrid.x, y: this.playerGrid.y },
      )
      if (!d) continue

      const { dx, dy } = DIR_VEC[d]
      gs.dir = d
      gs.fromX = gs.gridX
      gs.fromY = gs.gridY

      const tunnel = getTunnel(gs.gridX, gs.gridY, d)
      if (tunnel) {
        gs.gridX = tunnel.toX
        gs.gridY = tunnel.toY
        gs.sprite.setPosition(
          tunnel.toX * this.cellSize + this.cellSize / 2,
          tunnel.toY * this.cellSize + this.cellSize / 2,
        )
        gs.isMoving = false
        this.checkGhostCollision()
        continue
      }

      gs.gridX += dx
      gs.gridY += dy
      gs.isMoving = true

      // Check crossing with a moving player (swap-through)
      if (
        this.isPlayerMoving &&
        this.playerFromX === gs.gridX &&
        this.playerFromY === gs.gridY &&
        this.playerGrid.x === gs.fromX &&
        this.playerGrid.y === gs.fromY
      ) {
        this.die()
        return
      }

      const targetX = gs.gridX * this.cellSize + this.cellSize / 2
      const targetY = gs.gridY * this.cellSize + this.cellSize / 2

      this.tweens.add({
        targets: gs.sprite,
        x: targetX,
        y: targetY,
        duration: this.ghostMoveDuration,
        ease: 'Linear',
        onComplete: () => {
          gs.isMoving = false
          this.checkGhostCollision()
        },
      })
    }

    this.checkGhostCollision()
  }

  private checkGhostCollision() {
    if (!this.alive) return
    for (const gs of this.ghostStates) {
      if (gs.gridX === this.playerGrid.x && gs.gridY === this.playerGrid.y) {
        this.die()
        break
      }
    }
  }

  private die() {
    if (!this.alive) return
    this.alive = false
    this.playerDir = null
    this.restartBtn.hidden = false
    this.showOverlay()
  }

  private reset() {
    this.tweens.killAll()

    const fresh = parseMap(RAW_MAP)
    this.map.wall = fresh.wall
    this.map.dot = fresh.dot

    this.playerGrid = { ...fresh.player }
    this.playerDir = null
    this.queuedDir = null
    this.isPlayerMoving = false
    this.player.setPosition(
      fresh.player.x * this.cellSize + this.cellSize / 2,
      fresh.player.y * this.cellSize + this.cellSize / 2,
    )

    for (let i = 0; i < this.ghostStates.length; i++) {
      const gs = this.ghostStates[i]
      gs.gridX = fresh.ghosts[i].x
      gs.gridY = fresh.ghosts[i].y
      gs.fromX = fresh.ghosts[i].x
      gs.fromY = fresh.ghosts[i].y
      gs.dir = null
      gs.isMoving = false
      gs.sprite.setPosition(
        gs.gridX * this.cellSize + this.cellSize / 2,
        gs.gridY * this.cellSize + this.cellSize / 2,
      )
    }

    this.score = 0
    this.alive = true
    this.won = false
    this.scoreEl.textContent = '0'
    this.restartBtn.hidden = true
    this.hideOverlay()

    this.dotGroup.clear(true, true)
    this.createDots()
  }

  update() {
    if (!this.alive || this.won) return

    if (this.keys.UP?.isDown || this.keys.W?.isDown) this.tryQueue('up')
    if (this.keys.DOWN?.isDown || this.keys.S?.isDown) this.tryQueue('down')
    if (this.keys.LEFT?.isDown || this.keys.A?.isDown) this.tryQueue('left')
    if (this.keys.RIGHT?.isDown || this.keys.D?.isDown) this.tryQueue('right')
  }
}

function main() {
  const parent = document.getElementById('game')
  if (!parent) return

  // Initial size estimate; scene recalculates on boot
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 264,
    height: 418,
    backgroundColor: '#e8e4f0',
    scale: {
      mode: Phaser.Scale.NONE,
    },
    scene: GameScene,
    input: {
      touch: { capture: true },
    },
    render: {
      pixelArt: false,
      antialias: true,
    },
  })
}

main()
