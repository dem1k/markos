export type NodeKind = 'file' | 'folder' | 'game'
export type GameId = 'worm' | 'tetris'

export interface FsNode {
  id: string
  parentId: string | null
  kind: NodeKind
  name: string
  badge: string
  content: string
  game?: GameId
  x: number
  y: number
}

export interface DeskWindow {
  id: string
  nodeId: string
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
}

export interface DeskState {
  nodes: FsNode[]
  windows: DeskWindow[]
  selectedId: string | null
  nextZ: number
  user: string | null
}

const STORAGE_KEY = 'markos.desktop'
const USER_KEY = 'markos.user'

export const STARTERS: { name: string; badge: string }[] = [
  { name: 'systembootup', badge: '.s' },
  { name: 'server', badge: '.s' },
  { name: 'output', badge: '15' },
  { name: 'input 5', badge: 'in' },
  { name: 'system 15', badge: '140' },
  { name: 'intel 100', badge: 'i85' },
  { name: 'reg 1', badge: 'r1' },
  { name: 'reg 2', badge: 'r2' },
  { name: 'format 20', badge: '20' },
  { name: '#50', badge: 'addr' },
  { name: 'ram', badge: 'sys' },
  { name: 'rom', badge: 'sys' },
  { name: 'systemmain', badge: 'main' },
  { name: 'internal', badge: 'int' },
  { name: 'sys', badge: 'sys' },
]

export const GAMES: { name: string; badge: string; game: GameId }[] = [
  { name: 'worm', badge: 'W', game: 'worm' },
  { name: 'tetris', badge: 'T', game: 'tetris' },
]

let seq = 1
export function uid(prefix = 'n'): string {
  return `${prefix}${Date.now().toString(36)}${seq++}`
}

function placeAt(i: number): { x: number; y: number } {
  const cols = 5
  return { x: 24 + (i % cols) * 100, y: 24 + Math.floor(i / cols) * 110 }
}

function seedNodes(): FsNode[] {
  const files = STARTERS.map((s, i) => ({
    id: uid('s'),
    parentId: null,
    kind: 'file' as const,
    name: s.name,
    badge: s.badge,
    content: '',
    ...placeAt(i),
  }))
  const games = GAMES.map((g, i) => ({
    id: uid('g'),
    parentId: null,
    kind: 'game' as const,
    name: g.name,
    badge: g.badge,
    content: '',
    game: g.game,
    ...placeAt(STARTERS.length + i),
  }))
  return [...files, ...games]
}

export function ensureGames(state: DeskState): void {
  const names = new Set(state.nodes.map((n) => n.name))
  let i = state.nodes.filter((n) => n.parentId === null).length
  let changed = false
  for (const g of GAMES) {
    if (names.has(g.name)) continue
    state.nodes.push({
      id: uid('g'),
      parentId: null,
      kind: 'game',
      name: g.name,
      badge: g.badge,
      content: '',
      game: g.game,
      ...placeAt(i++),
    })
    changed = true
  }
  if (changed) saveState(state)
}

export function createState(): DeskState {
  return {
    nodes: seedNodes(),
    windows: [],
    selectedId: null,
    nextZ: 1,
    user: null,
  }
}

export function loadState(): DeskState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createState()
    const parsed = JSON.parse(raw) as DeskState
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) return createState()
    parsed.windows = parsed.windows || []
    parsed.selectedId = null
    parsed.nextZ = parsed.nextZ || 1
    parsed.user = parsed.user || null
    ensureGames(parsed)
    return parsed
  } catch {
    return createState()
  }
}

export function saveState(state: DeskState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadLastUser(): string | null {
  return localStorage.getItem(USER_KEY)
}

export function saveLastUser(name: string): void {
  localStorage.setItem(USER_KEY, name)
}

export function childrenOf(state: DeskState, parentId: string | null): FsNode[] {
  return state.nodes.filter((n) => n.parentId === parentId)
}

export function getNode(state: DeskState, id: string): FsNode | undefined {
  return state.nodes.find((n) => n.id === id)
}

export function createNode(
  state: DeskState,
  kind: NodeKind,
  parentId: string | null,
  x: number,
  y: number,
): FsNode {
  const node: FsNode = {
    id: uid(kind === 'folder' ? 'f' : 'n'),
    parentId,
    kind,
    name: kind === 'folder' ? 'New Folder' : 'New File',
    badge: kind === 'folder' ? 'fld' : '',
    content: '',
    x,
    y,
  }
  state.nodes.push(node)
  saveState(state)
  return node
}

export function renameNode(state: DeskState, id: string, name: string): void {
  const n = getNode(state, id)
  if (!n) return
  n.name = name.trim() || n.name
  saveState(state)
}

export function deleteNode(state: DeskState, id: string): void {
  const toRemove = new Set<string>()
  const walk = (nid: string) => {
    toRemove.add(nid)
    state.nodes.filter((n) => n.parentId === nid).forEach((c) => walk(c.id))
  }
  walk(id)
  state.nodes = state.nodes.filter((n) => !toRemove.has(n.id))
  state.windows = state.windows.filter((w) => !toRemove.has(w.nodeId))
  if (state.selectedId && toRemove.has(state.selectedId)) state.selectedId = null
  saveState(state)
}

export function moveNode(
  state: DeskState,
  id: string,
  parentId: string | null,
  x: number,
  y: number,
): void {
  const n = getNode(state, id)
  if (!n) return
  if (parentId === id) return
  if (parentId) {
    const parent = getNode(state, parentId)
    if (!parent || parent.kind !== 'folder') return
    let p: string | null = parentId
    while (p) {
      if (p === id) return
      p = getNode(state, p)?.parentId ?? null
    }
  }
  n.parentId = parentId
  n.x = x
  n.y = y
  saveState(state)
}

export function setContent(state: DeskState, id: string, content: string): void {
  const n = getNode(state, id)
  if (!n || n.kind !== 'file') return
  n.content = content
  saveState(state)
}

export function restoreStarters(state: DeskState): void {
  const byName = new Map(state.nodes.map((n) => [n.name, n]))
  const system: FsNode[] = []
  for (const s of STARTERS) {
    let n = byName.get(s.name)
    if (!n) {
      n = {
        id: uid('s'),
        parentId: null,
        kind: 'file',
        name: s.name,
        badge: s.badge,
        content: '',
        x: 0,
        y: 0,
      }
      state.nodes.push(n)
    }
    n.parentId = null
    n.kind = 'file'
    n.badge = s.badge
    system.push(n)
  }
  for (const g of GAMES) {
    let n = byName.get(g.name)
    if (!n) {
      n = {
        id: uid('g'),
        parentId: null,
        kind: 'game',
        name: g.name,
        badge: g.badge,
        content: '',
        game: g.game,
        x: 0,
        y: 0,
      }
      state.nodes.push(n)
    }
    n.parentId = null
    n.kind = 'game'
    n.badge = g.badge
    n.game = g.game
    system.push(n)
  }
  system.forEach((n, i) => {
    const p = placeAt(i)
    n.x = p.x
    n.y = p.y
  })
  saveState(state)
}

export function openWindow(state: DeskState, nodeId: string): DeskWindow {
  const existing = state.windows.find((w) => w.nodeId === nodeId)
  if (existing) {
    existing.minimized = false
    existing.z = state.nextZ++
    saveState(state)
    return existing
  }
  const node = getNode(state, nodeId)
  const size =
    node?.kind === 'folder'
      ? { w: 360, h: 280 }
      : node?.kind === 'game'
        ? node.game === 'tetris'
          ? { w: 220, h: 380 }
          : { w: 320, h: 320 }
        : { w: 420, h: 300 }
  const win: DeskWindow = {
    id: uid('w'),
    nodeId,
    x: 80 + (state.windows.length % 6) * 24,
    y: 60 + (state.windows.length % 6) * 24,
    w: size.w,
    h: size.h,
    z: state.nextZ++,
    minimized: false,
    maximized: false,
  }
  state.windows.push(win)
  saveState(state)
  return win
}

export function focusWindow(state: DeskState, winId: string): void {
  const w = state.windows.find((x) => x.id === winId)
  if (!w) return
  w.z = state.nextZ++
  w.minimized = false
  saveState(state)
}

export function closeWindow(state: DeskState, winId: string): void {
  state.windows = state.windows.filter((w) => w.id !== winId)
  saveState(state)
}

export function minimizeWindow(state: DeskState, winId: string): void {
  const w = state.windows.find((x) => x.id === winId)
  if (!w) return
  w.minimized = true
  w.maximized = false
  saveState(state)
}

export function maximizeWindow(state: DeskState, winId: string): void {
  const w = state.windows.find((x) => x.id === winId)
  if (!w) return
  w.maximized = !w.maximized
  w.minimized = false
  saveState(state)
}

export function updateWindowPos(
  state: DeskState,
  winId: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
): void {
  const win = state.windows.find((x) => x.id === winId)
  if (!win) return
  win.x = x
  win.y = y
  if (w !== undefined) win.w = w
  if (h !== undefined) win.h = h
  saveState(state)
}
