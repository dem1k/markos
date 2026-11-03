export type AgeBand = 'kid' | 'teen' | 'adult'

export type VectorKey = 'programming' | 'hacking_ethical' | 'security' | 'communication'

export interface NetworkInfo {
  id: string
  ssid: string
  secure: boolean
  signal: number
}

export interface ScenarioNode {
  id: string
  title: string
  ageBands: AgeBand[]
  payload: Record<string, unknown>
  vectorDelta?: Partial<Record<VectorKey, number>>
}

export interface ScenarioEdge {
  id: string
  from: string
  to: string
  choiceLabel: string
  when?: {
    activity?: string
    networkId?: string
  }
}

export type LiveEvent =
  | { type: 'dialog'; payload: { title: string; text: string } }
  | { type: 'mail'; payload: { id: string; from: string; subject: string; body: string } }
  | {
      type: 'desktop_file'
      payload: {
        name: string
        badge: string
        content: string
        kind?: 'file' | 'app'
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
  networks: NetworkInfo[]
  nodes: ScenarioNode[]
  edges: ScenarioEdge[]
  events: {
    onOnline: LiveEvent[]
    onEmailCreated?: LiveEvent[]
    onServerDown?: LiveEvent[]
  }
}

export interface VectorState {
  programming: number
  hacking_ethical: number
  security: number
  communication: number
}

export interface ScenarioProgress {
  packId: string
  currentNodeId: string
  flags: Record<string, boolean | string>
  vectors: VectorState
  history: string[]
  online: boolean
  serverAlive: boolean
  networkId: string | null
  email?: string | null
}
