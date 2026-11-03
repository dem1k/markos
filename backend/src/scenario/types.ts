export type LiveEvent =
  | { type: 'dialog'; payload: { title: string; text: string } }
  | { type: 'mail'; payload: { id: string; from: string; subject: string; body: string } }
  | {
      type: 'desktop_file'
      payload: {
        name: string
        badge: string
        content: string
        kind?: string
        app?: string
      }
    }
  | { type: 'toast'; payload: { text: string } }
  | { type: 'task'; payload: { id: string; title: string; text: string } }
  | { type: 'open_app'; payload: { app: string; url?: string } }

export interface ScenarioPack {
  id: string
  title: string
  startNodeId: string
  networks: { id: string; ssid: string; secure: boolean; signal: number }[]
  nodes: {
    id: string
    title: string
    ageBands: string[]
    payload: Record<string, unknown>
    vectorDelta?: Record<string, number>
  }[]
  edges: {
    id: string
    from: string
    to: string
    choiceLabel: string
    when?: { activity?: string; networkId?: string }
  }[]
  events: {
    onOnline: LiveEvent[]
    onEmailCreated?: LiveEvent[]
    onServerDown?: LiveEvent[]
  }
}
