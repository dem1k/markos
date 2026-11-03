export type NodeKind = 'file' | 'folder' | 'game' | 'app'
export type GameId = 'worm' | 'tetris'
export type AppId = 'browser'

export interface FsNode {
  id: string
  parentId: string | null
  kind: NodeKind
  name: string
  badge: string
  content: string
  game?: GameId
  app?: AppId
  x: number
  y: number
}

export interface DeskWindow {
  id: string
  nodeId: string
  /** Folder currently shown inside explorer (navigates in-place). */
  viewId?: string
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

const STORAGE_KEY = 'markos.desktop.v2'
const USER_KEY = 'markos.user'

export const ID_MY_COMPUTER = 'my-computer'
export const ID_DISK_C = 'disk-c'
export const ID_MARKOS_SYS = 'markos-sys'
export const ID_GAMES = 'games'
/** @deprecated old id — migrated to ID_GAMES */
export const ID_GAMED = 'gamed'

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

function folderNode(
  id: string,
  parentId: string | null,
  name: string,
  badge: string,
  x: number,
  y: number,
): FsNode {
  return { id, parentId, kind: 'folder', name, badge, content: '', x, y }
}

function seedNodes(): FsNode[] {
  const nodes: FsNode[] = [
    folderNode(ID_MY_COMPUTER, null, 'My Computer', 'PC', 24, 24),
    folderNode(ID_DISK_C, ID_MY_COMPUTER, 'C:', 'C:', 16, 16),
    folderNode(ID_MARKOS_SYS, ID_DISK_C, 'markos.sys', 'sys', 16, 16),
    folderNode(ID_GAMES, ID_DISK_C, 'games', 'gam', 116, 16),
  ]
  STARTERS.forEach((s, i) => {
    nodes.push({
      id: uid('s'),
      parentId: ID_MARKOS_SYS,
      kind: 'file',
      name: s.name,
      badge: s.badge,
      content: '',
      ...placeAt(i),
    })
  })
  GAMES.forEach((g, i) => {
    nodes.push({
      id: uid('g'),
      parentId: ID_GAMES,
      kind: 'game',
      name: g.name,
      badge: g.badge,
      content: '',
      game: g.game,
      ...placeAt(i),
    })
  })
  return nodes
}

export function ensureLayout(state: DeskState): void {
  let changed = false
  const ensureFolder = (
    id: string,
    parentId: string | null,
    name: string,
    badge: string,
    x: number,
    y: number,
  ) => {
    let n = state.nodes.find((x) => x.id === id)
    if (!n) {
      n = folderNode(id, parentId, name, badge, x, y)
      state.nodes.push(n)
      changed = true
    } else {
      n.parentId = parentId
      n.kind = 'folder'
      n.name = name
      n.badge = badge
    }
  }
  ensureFolder(ID_MY_COMPUTER, null, 'My Computer', 'PC', 24, 24)
  ensureFolder(ID_DISK_C, ID_MY_COMPUTER, 'C:', 'C:', 16, 16)
  ensureFolder(ID_MARKOS_SYS, ID_DISK_C, 'markos.sys', 'sys', 16, 16)
  ensureFolder(ID_GAMES, ID_DISK_C, 'games', 'gam', 116, 16)
  const legacyGames = state.nodes.find((x) => x.id === ID_GAMED || x.name === 'gamed')
  if (legacyGames && legacyGames.id !== ID_GAMES) {
    state.nodes = state.nodes.filter((x) => x.id !== legacyGames.id)
    changed = true
  }
  for (const s of STARTERS) {
    let n = state.nodes.find((x) => x.name === s.name && x.kind === 'file')
    if (!n) {
      state.nodes.push({
        id: uid('s'),
        parentId: ID_MARKOS_SYS,
        kind: 'file',
        name: s.name,
        badge: s.badge,
        content: '',
        ...placeAt(state.nodes.filter((x) => x.parentId === ID_MARKOS_SYS).length),
      })
      changed = true
    } else if (n.parentId !== ID_MARKOS_SYS) {
      n.parentId = ID_MARKOS_SYS
      changed = true
    }
  }
  for (const g of GAMES) {
    let n = state.nodes.find((x) => x.name === g.name && x.kind === 'game')
    if (!n) {
      state.nodes.push({
        id: uid('g'),
        parentId: ID_GAMES,
        kind: 'game',
        name: g.name,
        badge: g.badge,
        content: '',
        game: g.game,
        ...placeAt(state.nodes.filter((x) => x.parentId === ID_GAMES).length),
      })
      changed = true
    } else if (n.parentId !== ID_GAMES) {
      n.parentId = ID_GAMES
      n.game = g.game
      changed = true
    }
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
    ensureLayout(parsed)
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
  ensureLayout(state)
  const sysKids = state.nodes.filter((n) => n.parentId === ID_MARKOS_SYS && n.kind === 'file')
  sysKids.forEach((n, i) => {
    const p = placeAt(i)
    n.x = p.x
    n.y = p.y
  })
  const gameKids = state.nodes.filter((n) => n.parentId === ID_GAMES && n.kind === 'game')
  gameKids.forEach((n, i) => {
    const p = placeAt(i)
    n.x = p.x
    n.y = p.y
  })
  const mc = getNode(state, ID_MY_COMPUTER)
  if (mc) {
    mc.x = 24
    mc.y = 24
  }
  saveState(state)
}

export function folderPath(state: DeskState, folderId: string): FsNode[] {
  const path: FsNode[] = []
  let cur: FsNode | undefined = getNode(state, folderId)
  while (cur) {
    path.unshift(cur)
    cur = cur.parentId ? getNode(state, cur.parentId) : undefined
  }
  return path
}

export function navigateExplorer(state: DeskState, winId: string, folderId: string): void {
  const w = state.windows.find((x) => x.id === winId)
  const folder = getNode(state, folderId)
  if (!w || !folder || folder.kind !== 'folder') return
  w.viewId = folderId
  w.minimized = false
  w.z = state.nextZ++
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
      ? { w: 420, h: 320 }
      : node?.kind === 'game'
        ? node.game === 'tetris'
          ? { w: 220, h: 380 }
          : { w: 320, h: 320 }
        : node?.kind === 'app'
          ? { w: 480, h: 360 }
          : { w: 420, h: 300 }
  const win: DeskWindow = {
    id: uid('w'),
    nodeId,
    viewId: node?.kind === 'folder' ? nodeId : undefined,
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
