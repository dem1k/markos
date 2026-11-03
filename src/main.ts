import './style.css'
import { renderStart, renderBoot, renderUsers, type Phase } from './boot'
import { deskIconHtml, escapeHtml } from './icons'
import { mountWorm } from './games/worm'
import { mountTetris } from './games/tetris'
import type { GameHandle } from './games/worm'
import day1 from './content/scenarios/day1.json'
import type { ScenarioPack, ScenarioProgress, LiveEvent } from './scenario/types'
import { applyActivity, loadProgress, currentHint } from './scenario/engine'
import { networkTrayHtml, openNetworkWindow } from './scenario/network'
import { applyLiveEvents } from './scenario/events'
import { guestAuth, connectLive, postActivity, probeServerAlive } from './scenario/bridge'
import { mountBrowser } from './apps/browser'
import {
  type DeskState,
  type FsNode,
  loadState,
  saveState,
  childrenOf,
  getNode,
  createNode,
  renameNode,
  deleteNode,
  moveNode,
  setContent,
  restoreStarters,
  openWindow,
  focusWindow,
  closeWindow,
  minimizeWindow,
  maximizeWindow,
  updateWindowPos,
  folderPath,
  navigateExplorer,
} from './model'

const app = document.querySelector<HTMLElement>('#app')!
let phase: Phase = 'start'
let state: DeskState = loadState()
let menuEl: HTMLElement | null = null
let startMenuEl: HTMLElement | null = null
let renamingId: string | null = null
let clockTimer: number | null = null
const gameHandles = new Map<string, GameHandle>()
const browserHandles = new Map<string, { destroy: () => void; navigate: (u: string) => void }>()
const scenarioPack = day1 as ScenarioPack
let scenario: ScenarioProgress = loadProgress(scenarioPack)
let liveSend: ((a: { type: string; networkId?: string }) => void) | null = null
let authToken: string | null = null
let pendingBrowserUrl: string | null = null

function destroyGames(): void {
  for (const h of gameHandles.values()) h.destroy()
  gameHandles.clear()
  for (const h of browserHandles.values()) h.destroy()
  browserHandles.clear()
}

function topZ(): number {
  return Math.max(0, ...state.windows.map((w) => w.z))
}

function formatClock(d = new Date()): string {
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function setPhase(p: Phase): void {
  phase = p
  render()
}

function render(): void {
  hideMenu()
  if (phase === 'start') {
    renderStart(app, () => setPhase('boot'))
    return
  }
  if (phase === 'boot') {
    renderBoot(app, () => setPhase('users'))
    return
  }
  if (phase === 'users') {
    renderUsers(app, (name) => {
      state.user = name
      saveState(state)
      setPhase('desktop')
      if (!scenario.online) {
        setTimeout(() => {
          showScenarioDialog(
            'Network',
            String(scenarioPack.nodes.find((n) => n.id === scenario.currentNodeId)?.payload?.hint || 'Connect to Wi-Fi.'),
          )
        }, 400)
      }
    })
    return
  }
  renderDesktop()
}

function renderDesktop(): void {
  const maxZ = topZ()
  hideStartMenu()
  destroyGames()
  app.innerHTML = `<div class="desktop">
    <div class="desk-surface" data-surface="desktop"></div>
    <div class="windows-layer"></div>
    <div class="taskbar">
      <button type="button" class="start-btn" id="startBtn">
        <span class="start-logo">m</span>
        <span class="start-label">markOS</span>
      </button>
      <div class="task-btns">
      ${state.windows
        .map((w) => {
          const n = getNode(state, w.nodeId)
          const view = w.viewId ? getNode(state, w.viewId) : n
          const active = !w.minimized && w.z === maxZ ? ' active' : ''
          return `<button type="button" class="task-btn${active}" data-win="${w.id}">${escapeHtml(view?.name ?? n?.name ?? '?')}</button>`
        })
        .join('')}
      </div>
      <div class="task-tray">
        ${networkTrayHtml(scenario.online, scenario.networkId ? scenarioPack.networks.find((n) => n.id === scenario.networkId)?.ssid ?? null : null)}
        <span class="task-user">${escapeHtml(state.user ?? '')}</span>
        <span class="task-clock" id="taskClock">${formatClock()}</span>
      </div>
    </div>
  </div>`
  ensureClock()

  const surface = app.querySelector('.desk-surface') as HTMLElement
  for (const n of childrenOf(state, null)) {
    surface.insertAdjacentHTML(
      'beforeend',
      deskIconHtml(n.id, n.name, n.badge, state.selectedId === n.id, n.x, n.y, n.kind),
    )
  }

  const layer = app.querySelector('.windows-layer') as HTMLElement
  const wins = [...state.windows].sort((a, b) => a.z - b.z)
  for (const w of wins) {
    if (w.minimized) continue
    const node = getNode(state, w.nodeId)
    if (!node) continue
    const active = w.z === maxZ ? '' : ' inactive'
    const maxed = w.maximized ? ' maximized' : ''
    const viewId = node.kind === 'folder' ? w.viewId || node.id : node.id
    const viewNode = getNode(state, viewId) || node
    const crumbs =
      node.kind === 'folder'
        ? folderPath(state, viewId)
            .map(
              (p, i, arr) =>
                `<button type="button" class="crumb" data-win-nav="${w.id}" data-folder="${p.id}">${escapeHtml(p.name)}</button>${i < arr.length - 1 ? '<span class="crumb-sep">/</span>' : ''}`,
            )
            .join('')
        : ''
    const body =
      node.kind === 'folder'
        ? `<div class="explorer-bar"><button type="button" class="explorer-up" data-win-up="${w.id}" title="Up">^</button><div class="explorer-path">${crumbs}</div></div>
           <div class="window-body"><div class="folder-surface" data-surface="${viewId}" data-explorer="${w.id}"></div></div>`
        : node.kind === 'game'
          ? `<div class="window-body game-body"><div class="game-host" data-game-host="${w.id}" data-game="${node.game ?? ''}"></div></div>`
          : node.kind === 'app'
            ? `<div class="window-body app-body"><div class="app-host" data-app-host="${w.id}" data-app="${node.app ?? ''}"></div></div>`
            : `<div class="window-body file-body"><textarea class="file-editor" data-file="${node.id}">${escapeHtml(node.content)}</textarea></div>`
    layer.insertAdjacentHTML(
      'beforeend',
      `<div class="window${active}${maxed}" data-win="${w.id}" style="left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px;z-index:${w.z}">
        <div class="title-bar" data-move="${w.id}">
          <button type="button" class="win-btn" data-sys="${w.id}">-</button>
          <div class="title-text">${escapeHtml(viewNode.name)}</div>
          <button type="button" class="win-btn" data-min="${w.id}">_</button>
          <button type="button" class="win-btn" data-max="${w.id}">[]</button>
          <button type="button" class="win-btn" data-close="${w.id}">x</button>
        </div>
        ${body}
      </div>`,
    )
  }

  for (const w of wins) {
    if (w.minimized) continue
    const node = getNode(state, w.nodeId)
    if (!node || node.kind !== 'folder') continue
    const viewId = w.viewId || node.id
    const folderSurface = app.querySelector(
      `.folder-surface[data-explorer="${w.id}"]`,
    ) as HTMLElement | null
    if (!folderSurface) continue
    for (const child of childrenOf(state, viewId)) {
      folderSurface.insertAdjacentHTML(
        'beforeend',
        deskIconHtml(
          child.id,
          child.name,
          child.badge,
          state.selectedId === child.id,
          child.x,
          child.y,
          child.kind,
        ),
      )
    }
  }

  if (renamingId) startRename(renamingId)
  bindDesktop()
  mountGameWindows(wins, maxZ)
  mountAppWindows(wins, maxZ)
}

function showScenarioDialog(title: string, text: string): void {
  const existing = document.getElementById('scenarioDialog')
  existing?.remove()
  const dlg = document.createElement('div')
  dlg.id = 'scenarioDialog'
  dlg.className = 'scenario-dialog'
  dlg.innerHTML = `<div class="scenario-dialog-inner">
    <div class="title-bar"><div class="title-text">${escapeHtml(title)}</div>
      <button type="button" class="win-btn" id="scenarioDlgClose">x</button></div>
    <div class="scenario-dialog-body">${escapeHtml(text)}</div>
    <div class="scenario-dialog-hint">${escapeHtml(currentHint(scenarioPack, scenario))}</div>
  </div>`
  document.body.appendChild(dlg)
  dlg.querySelector('#scenarioDlgClose')?.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    dlg.remove()
  })
}

function handleLiveEvents(events: LiveEvent[]): void {
  if (!events.length) return
  applyLiveEvents(state, events, {
    showDialog: showScenarioDialog,
    openBrowser: (url) => {
      pendingBrowserUrl = url || 'mail.markos'
      ensureBrowserIcon()
    },
  })
  renderDesktop()
  if (pendingBrowserUrl) {
    const url = pendingBrowserUrl
    pendingBrowserUrl = null
    openBrowserApp(url)
  }
}

function ensureBrowserIcon(): void {
  if (state.nodes.some((n) => n.kind === 'app' && n.app === 'browser')) return
  state.nodes.push({
    id: `browser-${Date.now().toString(36)}`,
    parentId: null,
    kind: 'app',
    name: 'browser',
    badge: 'www',
    content: 'app:browser',
    app: 'browser',
    x: 520,
    y: 40,
  })
  saveState(state)
}

function openBrowserApp(url?: string): void {
  ensureBrowserIcon()
  const node = state.nodes.find((n) => n.kind === 'app' && n.app === 'browser')
  if (!node) return
  pendingBrowserUrl = url || 'mail.markos'
  openWindow(state, node.id)
  renderDesktop()
}

async function ensureLiveLink(): Promise<boolean> {
  if (liveSend && authToken) return true
  const guest = await guestAuth()
  if (!guest) return false
  authToken = guest.token
  const conn = connectLive(guest.token, handleLiveEvents)
  liveSend = conn.sendActivity
  return true
}

async function onNetworkConnect(networkId: string): Promise<void> {
  document.querySelector('.net-window')?.remove()
  const alive = await probeServerAlive()
  if (!alive) {
    handleLiveEvents(scenarioPack.events.onServerDown || [])
    renderDesktop()
    return
  }

  const wasOffline = !scenario.online
  const result = applyActivity(scenarioPack, scenario, {
    type: 'network.connected',
    networkId,
  })
  scenario = result.progress

  if (wasOffline) {
    await ensureLiveLink()
    let events = result.events
    if (authToken) {
      const remote = await postActivity(authToken, { type: 'network.connected', networkId })
      if (remote.length) events = remote
    }
    handleLiveEvents(events)
  } else {
    renderDesktop()
  }
}

function onEmailCreated(user: string, domain: string): void {
  const email = `${user}@${domain}`
  const result = applyActivity(scenarioPack, scenario, {
    type: 'email.created',
    email,
  })
  scenario = result.progress
  void (async () => {
    let events = result.events
    if (authToken) {
      const remote = await postActivity(authToken, { type: 'email.created', email })
      if (remote.length) events = remote
    }
    handleLiveEvents(events)
  })()
}

function openNetworkPanel(): void {
  document.querySelector('.net-window')?.remove()
  const layer = app.querySelector('.windows-layer') || app
  const win = openNetworkWindow(scenarioPack, scenario.online, scenario.networkId, (net) => {
    void onNetworkConnect(net.id)
  })
  layer.appendChild(win)
}

function mountGameWindows(
  wins: { id: string; minimized: boolean; z: number; nodeId: string }[],
  maxZ: number,
): void {
  for (const w of wins) {
    if (w.minimized) continue
    const node = getNode(state, w.nodeId)
    if (!node || node.kind !== 'game' || !node.game) continue
    const host = app.querySelector(`[data-game-host="${w.id}"]`) as HTMLElement | null
    if (!host) continue
    const handle = node.game === 'tetris' ? mountTetris(host) : mountWorm(host)
    gameHandles.set(w.id, handle)
    if (w.z === maxZ) {
      const canvas = host.querySelector('canvas') as HTMLCanvasElement | null
      canvas?.focus()
    }
  }
}

function mountAppWindows(
  wins: { id: string; minimized: boolean; z: number; nodeId: string }[],
  maxZ: number,
): void {
  for (const w of wins) {
    if (w.minimized) continue
    const node = getNode(state, w.nodeId)
    if (!node || node.kind !== 'app' || node.app !== 'browser') continue
    const host = app.querySelector(`[data-app-host="${w.id}"]`) as HTMLElement | null
    if (!host) continue
    const startUrl = pendingBrowserUrl || 'mail.markos'
    pendingBrowserUrl = null
    const handle = mountBrowser(host, {
      startUrl,
      onCreateEmail: ({ user, domain }) => onEmailCreated(user, domain),
    })
    browserHandles.set(w.id, handle)
    if (w.z === maxZ) host.focus()
  }
}

function ensureClock(): void {
  if (clockTimer !== null) return
  clockTimer = window.setInterval(() => {
    const el = document.getElementById('taskClock')
    if (el) el.textContent = formatClock()
  }, 1000)
}

function hideStartMenu(): void {
  startMenuEl?.remove()
  startMenuEl = null
}

function toggleStartMenu(): void {
  if (startMenuEl) {
    hideStartMenu()
    return
  }
  const btn = document.getElementById('startBtn')
  if (!btn) return
  startMenuEl = document.createElement('div')
  startMenuEl.className = 'start-menu'
  startMenuEl.innerHTML = `
    <div class="start-menu-side">markOS</div>
    <div class="start-menu-items">
      <button type="button" class="ctx-item" data-start="about">About markOS</button>
      <button type="button" class="ctx-item" data-start="restore">Restore system icons</button>
      <div class="ctx-sep"></div>
      <button type="button" class="ctx-item" data-start="reboot">Restart...</button>
    </div>`
  document.body.appendChild(startMenuEl)
  startMenuEl.querySelectorAll('[data-start]').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const act = (el as HTMLElement).dataset.start
      hideStartMenu()
      if (act === 'restore') {
        restoreStarters(state)
        renderDesktop()
      } else if (act === 'reboot') {
        location.reload()
      } else if (act === 'about') {
        alert('markOS\nA playground OS by Mark.')
      }
    })
  })
  setTimeout(() => {
    const onDoc = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.start-menu, #startBtn')) return
      hideStartMenu()
      document.removeEventListener('mousedown', onDoc)
    }
    document.addEventListener('mousedown', onDoc)
  }, 0)
}

function bindDesktop(): void {
  app.querySelectorAll('.desk-icon').forEach((el) => {
    const id = (el as HTMLElement).dataset.id!
    el.addEventListener('mousedown', (e) => onIconDown(e as MouseEvent, id, el as HTMLElement))
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      const explorer = (el as HTMLElement).closest('[data-explorer]') as HTMLElement | null
      const n = getNode(state, id)
      if (n?.kind === 'folder' && explorer?.dataset.explorer) {
        navigateExplorer(state, explorer.dataset.explorer, id)
        renderDesktop()
        return
      }
      openNode(id)
    })
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      state.selectedId = id
      showMenu(e as MouseEvent, id, getNode(state, id)?.parentId ?? null)
    })
  })

  app.querySelectorAll('[data-surface]').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.desk-icon')) return
      state.selectedId = null
      hideMenu()
      refreshSelection()
    })
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if ((e.target as HTMLElement).closest('.desk-icon')) return
      const parentId = (el as HTMLElement).dataset.surface!
      showMenu(e as MouseEvent, null, parentId === 'desktop' ? null : parentId)
    })
  })

  app.querySelectorAll('.file-editor').forEach((el) => {
    const ta = el as HTMLTextAreaElement
    ta.addEventListener('input', () => setContent(state, ta.dataset.file!, ta.value))
    ta.addEventListener('mousedown', (e) => {
      const winEl = ta.closest('.window') as HTMLElement | null
      const winId = winEl?.dataset.win
      if (!winId) return
      const w = state.windows.find((x) => x.id === winId)
      if (w && w.z === topZ()) {
        e.stopPropagation()
        return
      }
      focusWindow(state, winId)
      const fileId = ta.dataset.file!
      renderDesktop()
      requestAnimationFrame(() => {
        const next = app.querySelector(`.file-editor[data-file="${fileId}"]`) as HTMLTextAreaElement | null
        next?.focus()
      })
      e.preventDefault()
      e.stopPropagation()
    })
  })

  app.querySelectorAll('.window').forEach((el) => {
    const winId = (el as HTMLElement).dataset.win!
    el.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.win-btn')) return
      hideMenu()
      hideStartMenu()
      const w = state.windows.find((x) => x.id === winId)
      if (w && w.z === topZ() && !w.minimized) return
      focusWindow(state, winId)
      renderDesktop()
    })
  })

  app.querySelectorAll('[data-move]').forEach((el) => {
    el.addEventListener('mousedown', (e) => onWinMove(e as MouseEvent, (el as HTMLElement).dataset.move!))
  })

  const winAction = (
    sel: string,
    key: 'close' | 'min' | 'max' | 'sys',
    fn: (id: string) => void,
  ) => {
    app.querySelectorAll(sel).forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const id = (el as HTMLElement).dataset[key]!
        fn(id)
        renderDesktop()
      })
    })
  }
  winAction('[data-close]', 'close', (id) => closeWindow(state, id))
  winAction('[data-min]', 'min', (id) => minimizeWindow(state, id))
  winAction('[data-max]', 'max', (id) => maximizeWindow(state, id))
  winAction('[data-sys]', 'sys', (id) => closeWindow(state, id))

  document.getElementById('startBtn')?.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    toggleStartMenu()
  })

  document.getElementById('netTray')?.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    openNetworkPanel()
  })

  app.querySelectorAll('[data-win-nav]').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const winId = (el as HTMLElement).dataset.winNav!
      const folderId = (el as HTMLElement).dataset.folder!
      navigateExplorer(state, winId, folderId)
      renderDesktop()
    })
  })
  app.querySelectorAll('[data-win-up]').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const winId = (el as HTMLElement).dataset.winUp!
      const w = state.windows.find((x) => x.id === winId)
      if (!w) return
      const viewId = w.viewId || w.nodeId
      const cur = getNode(state, viewId)
      if (cur?.parentId) {
        navigateExplorer(state, winId, cur.parentId)
        renderDesktop()
      }
    })
  })

  app.querySelectorAll('.task-btn').forEach((el) => {
    el.addEventListener('click', () => {
      const winId = (el as HTMLElement).dataset.win!
      const w = state.windows.find((x) => x.id === winId)
      if (!w) return
      if (w.minimized) {
        w.minimized = false
        focusWindow(state, winId)
      } else if (w.z === topZ()) {
        minimizeWindow(state, winId)
      } else {
        focusWindow(state, winId)
      }
      renderDesktop()
    })
  })
}

function refreshSelection(): void {
  app.querySelectorAll('.desk-icon').forEach((el) => {
    const id = (el as HTMLElement).dataset.id
    el.classList.toggle('selected', id === state.selectedId)
  })
}

function openNode(id: string): void {
  const n = getNode(state, id)
  if (!n) return
  if (n.kind === 'folder') {
    const existing = state.windows.find((w) => {
      const root = getNode(state, w.nodeId)
      return root?.kind === 'folder' && !w.minimized
    })
    if (existing) {
      navigateExplorer(state, existing.id, id)
      renderDesktop()
      return
    }
  }
  openWindow(state, id)
  renderDesktop()
}

function onIconDown(e: MouseEvent, id: string, el: HTMLElement): void {
  if (e.button !== 0) return
  e.stopPropagation()
  hideMenu()
  state.selectedId = id
  refreshSelection()

  const node = getNode(state, id)
  if (!node) return
  const startX = e.clientX
  const startY = e.clientY
  const origX = node.x
  const origY = node.y
  let dragged = false

  const parentSurface = el.closest('[data-surface]') as HTMLElement

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (!dragged && Math.abs(dx) + Math.abs(dy) < 4) return
    dragged = true
    el.classList.add('dragging')
    el.style.left = `${origX + dx}px`
    el.style.top = `${origY + dy}px`
  }

  const onUp = (ev: MouseEvent) => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    el.classList.remove('dragging')
    if (!dragged) return

    el.style.visibility = 'hidden'
    const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
    el.style.visibility = ''

    const folderIcon = under?.closest('.desk-icon[data-kind="folder"]') as HTMLElement | null
    const folderSurface = under?.closest('.folder-surface') as HTMLElement | null
    const deskSurface = under?.closest('[data-surface="desktop"]') as HTMLElement | null

    if (folderIcon && folderIcon.dataset.id !== id) {
      const kids = childrenOf(state, folderIcon.dataset.id!).length
      moveNode(state, id, folderIcon.dataset.id!, 16 + (kids % 4) * 90, 16 + Math.floor(kids / 4) * 100)
      renderDesktop()
      return
    }

    if (folderSurface) {
      const fid = folderSurface.dataset.surface!
      if (fid !== id) {
        const rect = folderSurface.getBoundingClientRect()
        moveNode(state, id, fid, Math.max(0, ev.clientX - rect.left - 40), Math.max(0, ev.clientY - rect.top - 24))
        renderDesktop()
        return
      }
    }

    if (deskSurface || parentSurface.dataset.surface === 'desktop') {
      const nx = Math.max(0, origX + (ev.clientX - startX))
      const ny = Math.max(0, origY + (ev.clientY - startY))
      if (node.parentId !== null && deskSurface) {
        moveNode(state, id, null, Math.max(0, ev.clientX - deskSurface.getBoundingClientRect().left - 40), Math.max(0, ev.clientY - deskSurface.getBoundingClientRect().top - 24))
      } else {
        moveNode(state, id, node.parentId, nx, ny)
      }
      renderDesktop()
      return
    }

    const nx = Math.max(0, origX + (ev.clientX - startX))
    const ny = Math.max(0, origY + (ev.clientY - startY))
    moveNode(state, id, node.parentId, nx, ny)
    renderDesktop()
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onWinMove(e: MouseEvent, winId: string): void {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('.win-btn')) return
  e.preventDefault()
  e.stopPropagation()
  const win = state.windows.find((w) => w.id === winId)
  if (!win || win.maximized) {
    focusWindow(state, winId)
    renderDesktop()
    return
  }
  focusWindow(state, winId)
  const el = app.querySelector(`.window[data-win="${winId}"]`) as HTMLElement
  const startX = e.clientX
  const startY = e.clientY
  const ox = win.x
  const oy = win.y

  const onMove = (ev: MouseEvent) => {
    el.style.left = `${ox + (ev.clientX - startX)}px`
    el.style.top = `${oy + (ev.clientY - startY)}px`
  }
  const onUp = (ev: MouseEvent) => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    updateWindowPos(state, winId, ox + (ev.clientX - startX), oy + (ev.clientY - startY))
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function hideMenu(): void {
  menuEl?.remove()
  menuEl = null
}

function showMenu(e: MouseEvent, nodeId: string | null, parentId: string | null): void {
  hideMenu()
  const items: { label: string; action: () => void; sep?: boolean }[] = []
  if (nodeId) {
    items.push({ label: 'Open', action: () => openNode(nodeId) })
    items.push({ label: 'Rename', action: () => { renamingId = nodeId; renderDesktop() } })
    items.push({ label: 'Delete', action: () => { deleteNode(state, nodeId); renderDesktop() } })
    items.push({ label: '', action: () => {}, sep: true })
  }
  items.push({
    label: 'New Folder',
    action: () => {
      const n = createNode(state, 'folder', parentId, e.offsetX || 40, e.offsetY || 40)
      placeNew(n, parentId, e)
      renamingId = n.id
      renderDesktop()
    },
  })
  items.push({
    label: 'New File',
    action: () => {
      const n = createNode(state, 'file', parentId, e.offsetX || 40, e.offsetY || 40)
      placeNew(n, parentId, e)
      renamingId = n.id
      renderDesktop()
    },
  })
  if (parentId === null) {
    items.push({ label: '', action: () => {}, sep: true })
    items.push({
      label: 'Restore system icons',
      action: () => {
        restoreStarters(state)
        renderDesktop()
      },
    })
  }

  menuEl = document.createElement('div')
  menuEl.className = 'ctx-menu'
  menuEl.style.left = `${e.clientX}px`
  menuEl.style.top = `${e.clientY}px`
  for (const it of items) {
    if (it.sep) {
      const sep = document.createElement('div')
      sep.className = 'ctx-sep'
      menuEl.appendChild(sep)
      continue
    }
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ctx-item'
    btn.textContent = it.label
    btn.addEventListener('mousedown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      hideMenu()
      it.action()
    })
    menuEl.appendChild(btn)
  }
  document.body.appendChild(menuEl)
  const onDoc = (ev: MouseEvent) => {
    if ((ev.target as HTMLElement).closest('.ctx-menu')) return
    hideMenu()
    document.removeEventListener('mousedown', onDoc)
  }
  setTimeout(() => document.addEventListener('mousedown', onDoc), 0)
}

function placeNew(n: FsNode, parentId: string | null, e: MouseEvent): void {
  const surfaceSel = parentId === null ? '[data-surface="desktop"]' : `[data-surface="${parentId}"]`
  const surface = app.querySelector(surfaceSel) as HTMLElement | null
  if (!surface) return
  const rect = surface.getBoundingClientRect()
  n.x = Math.max(0, e.clientX - rect.left - 40)
  n.y = Math.max(0, e.clientY - rect.top - 24)
  saveState(state)
}

function startRename(id: string): void {
  renamingId = null
  const el = app.querySelector(`.desk-icon[data-id="${id}"] .desk-label`) as HTMLElement | null
  const node = getNode(state, id)
  if (!el || !node) return
  const input = document.createElement('input')
  input.value = node.name
  el.textContent = ''
  el.appendChild(input)
  input.focus()
  input.select()
  const finish = () => {
    renameNode(state, id, input.value)
    renderDesktop()
  }
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') finish()
    if (ev.key === 'Escape') {
      renamingId = null
      renderDesktop()
    }
  })
  input.addEventListener('blur', finish)
}

render()
