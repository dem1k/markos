export type GameHandle = { destroy: () => void }

const COLS = 16
const ROWS = 14
const CELL = 16

export function mountWorm(host: HTMLElement): GameHandle {
  host.innerHTML = `<div class="game-wrap">
    <div class="game-hud">Worm <span data-score>0</span> — arrows / WASD — Enter restart</div>
    <canvas class="game-canvas" width="${COLS * CELL}" height="${ROWS * CELL}" tabindex="0"></canvas>
  </div>`
  const canvas = host.querySelector('canvas') as HTMLCanvasElement
  const scoreEl = host.querySelector('[data-score]') as HTMLElement
  const ctx = canvas.getContext('2d')!

  type Pt = { x: number; y: number }
  let snake: Pt[] = []
  let dir: Pt = { x: 1, y: 0 }
  let nextDir: Pt = { x: 1, y: 0 }
  let food: Pt = { x: 8, y: 7 }
  let score = 0
  let dead = false
  let timer = 0

  const placeFood = () => {
    for (let n = 0; n < 200; n++) {
      const p = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 }
      if (!snake.some((s) => s.x === p.x && s.y === p.y)) {
        food = p
        return
      }
    }
  }

  const reset = () => {
    snake = [
      { x: 4, y: 7 },
      { x: 3, y: 7 },
      { x: 2, y: 7 },
    ]
    dir = { x: 1, y: 0 }
    nextDir = { x: 1, y: 0 }
    score = 0
    dead = false
    scoreEl.textContent = '0'
    placeFood()
    draw()
  }

  const draw = () => {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#000'
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)
    ctx.fillStyle = '#000'
    for (const s of snake) ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2)
    ctx.fillRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6)
    if (dead) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillRect(20, canvas.height / 2 - 14, canvas.width - 40, 28)
      ctx.fillStyle = '#000'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('GAME OVER — Enter', canvas.width / 2, canvas.height / 2 + 4)
    }
  }

  const tick = () => {
    if (dead) return
    dir = nextDir
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
      dead = true
      draw()
      return
    }
    if (snake.some((s) => s.x === head.x && s.y === head.y)) {
      dead = true
      draw()
      return
    }
    snake.unshift(head)
    if (head.x === food.x && head.y === food.y) {
      score += 1
      scoreEl.textContent = String(score)
      placeFood()
    } else {
      snake.pop()
    }
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'enter') {
      e.preventDefault()
      reset()
      return
    }
    const map: Record<string, Pt> = {
      arrowup: { x: 0, y: -1 },
      w: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 },
      s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 },
      a: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 },
      d: { x: 1, y: 0 },
    }
    const nd = map[k]
    if (!nd) return
    e.preventDefault()
    if (nd.x === -dir.x && nd.y === -dir.y) return
    nextDir = nd
  }

  reset()
  timer = window.setInterval(tick, 140)
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
