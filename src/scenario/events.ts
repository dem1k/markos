import type { LiveEvent } from './types'
import type { DeskState } from '../model'
import { saveState, uid } from '../model'

export type EventHooks = {
  showDialog: (title: string, text: string) => void
  openBrowser?: (url?: string) => void
}

export function applyLiveEvents(state: DeskState, events: LiveEvent[], hooks: EventHooks): void {
  let i = 0
  for (const ev of events) {
    if (ev.type === 'dialog' || ev.type === 'task') {
      hooks.showDialog(ev.payload.title, ev.type === 'task' ? `Task: ${ev.payload.title}\n\n${ev.payload.text}` : ev.payload.text)
    } else if (ev.type === 'toast') {
      hooks.showDialog('markOS', ev.payload.text)
    } else if (ev.type === 'open_app') {
      if (ev.payload.app === 'browser') hooks.openBrowser?.(ev.payload.url)
    } else if (ev.type === 'desktop_file' || ev.type === 'mail') {
      const isApp = ev.type === 'desktop_file' && (ev.payload.kind === 'app' || ev.payload.app === 'browser')
      const name =
        ev.type === 'mail' ? `${ev.payload.subject.slice(0, 24)}.txt` : ev.payload.name
      const content =
        ev.type === 'mail'
          ? `From: ${ev.payload.from}\nSubject: ${ev.payload.subject}\n\n${ev.payload.body}`
          : ev.payload.content
      const badge = ev.type === 'mail' ? 'mail' : ev.payload.badge
      const existing = state.nodes.find((n) => n.parentId === null && n.name === name)
      if (existing) {
        existing.content = content
        existing.badge = badge
        if (isApp) {
          existing.kind = 'app'
          existing.app = 'browser'
        }
      } else {
        state.nodes.push({
          id: uid('n'),
          parentId: null,
          kind: isApp ? 'app' : 'file',
          name,
          badge,
          content,
          app: isApp ? 'browser' : undefined,
          x: 420 + (i % 3) * 90,
          y: 40 + Math.floor(i / 3) * 110,
        })
        i++
      }
      saveState(state)
    }
  }
}
