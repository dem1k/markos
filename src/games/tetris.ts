export type GameHandle = { destroy: () => void }

const COLS = 10
const ROWS = 18
const CELL = 16

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
]

export function mountTetris(host: HTMLElement): GameHandle {
  host.innerHTML = `<div class="game-wrap">
    <div class="game-hud">Tetris <span data-score>0</span> — arrows / WASD / Up rotate — Enter restart</div>
    <canvas class="game-canvas" width="${COLS * CELL}" height="${ROWS * CELL}" tabindex="0"></canvas>
  </div>`
  const canvas = host.querySelector('canvas') as HTMLCanvasElement
  const scoreEl = host.querySelector('[data-score]') as HTMLElement
  const ctx = canvas.getContext('2d')!

  let grid: number[][] = []
  let piece: { shape: number[][]; x: number; y: number } | null = null
  let score = 0
  let dead = false
  let timer = 0

  const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0))

  const spawn = () => {
    const shape = SHAPES[(Math.random() * SHAPES.length) | 0].map((r) => [...r])
    piece = { shape, x: ((COLS - shape[0].length) / 2) | 0, y: 0 }
    if (collides(piece.shape, piece.x, piece.y)) {
      dead = true
      piece = null
    }
  }

  const collides = (shape: number[][], x: number, y: number) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue
        const gx = x + c
        const gy = y + r
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true
        if (gy >= 0 && grid[gy][gx]) return true
      }
    }
    return false
  }

  const merge = () => {
    if (!piece) return
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue
        const gy = piece.y + r
        const gx = piece.x + c
        if (gy >= 0) grid[gy][gx] = 1
      }
    }
    let cleared = 0
    grid = grid.filter((row) => {
      if (row.every((v) => v)) {
        cleared++
        return false
      }
      return true
    })
    while (grid.length < ROWS) grid.unshift(Array(COLS).fill(0))
    if (cleared) {
      score += cleared * 100
      scoreEl.textContent = String(score)
    }
    spawn()
  }

  const rotate = () => {
    if (!piece || dead) return
    const src = piece.shape
    const next = src[0].map((_, i) => src.map((row) => row[i]).reverse())
    if (!collides(next, piece.x, piece.y)) piece.shape = next
  }

  const move = (dx: number, dy: number) => {
    if (!piece || dead) return false
    if (collides(piece.shape, piece.x + dx, piece.y + dy)) return false
    piece.x += dx
    piece.y += dy
    return true
  }

  const draw = () => {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#000'
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)
    const paint = (x: number, y: number) => {
      ctx.fillStyle = '#000'
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (grid[y][x]) paint(x, y)
    }
    if (piece) {
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c]) paint(piece.x + c, piece.y + r)
        }
      }
    }
    if (dead) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillRect(10, canvas.height / 2 - 14, canvas.width - 20, 28)
      ctx.fillStyle = '#000'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('GAME OVER — Enter', canvas.width / 2, canvas.height / 2 + 4)
    }
  }

  const tick = () => {
    if (dead) return
    if (!move(0, 1)) merge()
    draw()
  }

  const reset = () => {
    grid = emptyGrid()
    score = 0
    dead = false
    scoreEl.textContent = '0'
    spawn()
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'enter') {
      e.preventDefault()
      reset()
      return
    }
    if (dead) return
    if (k === 'arrowleft' || k === 'a') {
      e.preventDefault()
      move(-1, 0)
      draw()
    } else if (k === 'arrowright' || k === 'd') {
      e.preventDefault()
      move(1, 0)
      draw()
    } else if (k === 'arrowdown' || k === 's') {
      e.preventDefault()
      if (!move(0, 1)) merge()
      draw()
    } else if (k === 'arrowup' || k === 'w' || k === ' ') {
      e.preventDefault()
      rotate()
      draw()
    }
  }

  reset()
  timer = window.setInterval(tick, 450)
  canvas.addEventListener('keydown', onKey)
  canvas.addEventListener('mousedown', () => canvas.focus())
  canvas.focus()

  return {
    destroy: () => {
      clearInterval(timer)
      canvas.removeEventListener('keydown', onKey)
      host.innerHTML = ''
    },
  }
}
