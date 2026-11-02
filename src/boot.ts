import { iconBoxHtml, escapeHtml } from './icons'
import { loadLastUser, saveLastUser } from './model'

export type Phase = 'start' | 'boot' | 'users' | 'desktop'

const USERS = ['Mark', 'Guest', 'Admin']

let audioCtx: AudioContext | null = null

function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

/** Old 80s PC-speaker style beep for symbol reveals. */
function playGlitchTick(): void {
  try {
    const ctx = getAudio()
    if (ctx.state === 'suspended') return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1000 + Math.random() * 700
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.04, t + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  } catch {
    /* ignore audio errors */
  }
}

/** Soft note-block style motif (original, not a soundtrack rip). */
export function playBootMelody(): Promise<void> {
  const ctx = getAudio()
  if (ctx.state === 'suspended') void ctx.resume()
  const notes = [
    { f: 392, t: 0.0, d: 0.18 },
    { f: 523.25, t: 0.22, d: 0.18 },
    { f: 659.25, t: 0.44, d: 0.18 },
    { f: 783.99, t: 0.66, d: 0.28 },
    { f: 659.25, t: 1.05, d: 0.16 },
    { f: 587.33, t: 1.28, d: 0.16 },
    { f: 523.25, t: 1.5, d: 0.22 },
    { f: 392, t: 1.8, d: 0.35 },
  ]
  const now = ctx.currentTime + 0.05
  for (const n of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = n.f
    gain.gain.setValueAtTime(0.0001, now + n.t)
    gain.gain.exponentialRampToValueAtTime(0.08, now + n.t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + n.t)
    osc.stop(now + n.t + n.d + 0.02)
  }
  return new Promise((resolve) => setTimeout(resolve, 2300))
}

export function renderStart(root: HTMLElement, onStart: () => void): void {
  root.innerHTML = `<div class="boot-screen">
    <div class="boot-title">markOS</div>
    <button type="button" class="boot-start">Start</button>
  </div>`
  root.querySelector('.boot-start')!.addEventListener('click', () => {
    void getAudio().resume()
    onStart()
  })
}

const BOOT_LINES = [
  '[  0.000000] markOS kernel 0.1.0 loading...',
  '[  0.041203] CPU: markOS virtual intel 100',
  '[  0.082911] Memory: ram sys / rom sys mapped',
  '[  0.120004] Init: systembootup [.s]',
  '[  0.188442] Mounting server [.s] ... OK',
  '[  0.251109] Registers: reg1 r1, reg2 r2',
  '[  0.310887] Format 20 ... OK',
  '[  0.401223] Address space #50 [addr]',
  '[  0.488001] Loading systemmain [main]',
  '[  0.552340] Internal modules [int] linked',
  '[  0.631002] Starting output / input 5',
  '[  0.710554] Desktop shell ready.',
]

const GLITCH_CHARS = '01#@$%*&<>/\\|+-~?!=:;^'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function junk(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += GLITCH_CHARS[(Math.random() * GLITCH_CHARS.length) | 0]
  return s
}

async function glitchRevealLine(el: HTMLElement, done: string, line: string): Promise<void> {
  const prefix = done ? done + '\n' : ''
  let resolved = ''
  el.classList.add('glitching')
  for (let i = 0; i < line.length; i++) {
    const rest = line.length - i
    for (let g = 0; g < 2; g++) {
      el.textContent = prefix + resolved + junk(rest)
      el.scrollTop = el.scrollHeight
      await sleep(10 + Math.random() * 12)
    }
    resolved += line[i]
    playGlitchTick()
    if (Math.random() < 0.08) {
      el.textContent = prefix + resolved.slice(0, -1) + junk(1) + junk(rest - 1)
      await sleep(18)
    }
  }
  el.textContent = prefix + line
  el.classList.remove('glitching')
}

async function runBootLog(el: HTMLElement): Promise<void> {
  let done = ''
  for (const line of BOOT_LINES) {
    await glitchRevealLine(el, done, line)
    done = done ? done + '\n' + line : line
    el.textContent = done
    el.scrollTop = el.scrollHeight
    await sleep(40 + Math.random() * 50)
  }
}

export function renderBoot(root: HTMLElement, onDone: () => void): void {
  root.innerHTML = `<div class="boot-screen" id="bootOverlay">
    <div class="boot-center">
      <div class="boot-title">markOS</div>
      <div class="boot-loader">${iconBoxHtml('..', 'spin')}</div>
      <div class="boot-status">Starting markOS...</div>
    </div>
    <pre class="boot-log" id="bootLog"></pre>
  </div>`
  const log = root.querySelector('#bootLog') as HTMLElement
  void (async () => {
    await sleep(400)
    await runBootLog(log)
    await sleep(200)
    await playBootMelody()
    const overlay = root.querySelector('#bootOverlay') as HTMLElement | null
    if (overlay) {
      overlay.classList.add('fade-out')
      await sleep(600)
    }
    onDone()
  })()
}

export function renderUsers(root: HTMLElement, onPick: (name: string) => void): void {
  const last = loadLastUser()
  const cards = USERS.map((u) => {
    const badge = u.slice(0, 2).toUpperCase()
    const hi = last === u ? ' selected' : ''
    return `<button type="button" class="user-card${hi}" data-user="${escapeHtml(u)}">
      ${iconBoxHtml(badge)}
      <span class="user-name">${escapeHtml(u)}</span>
    </button>`
  }).join('')
  root.innerHTML = `<div class="users-screen fade-in">
    <div class="users-title">Who is using markOS?</div>
    <div class="users-row">${cards}</div>
  </div>`
  root.querySelectorAll('.user-card').forEach((el) => {
    el.addEventListener('click', () => {
      const name = (el as HTMLElement).dataset.user!
      saveLastUser(name)
      const screen = root.querySelector('.users-screen') as HTMLElement
      screen.classList.add('fade-out')
      setTimeout(() => onPick(name), 400)
    })
  })
}
