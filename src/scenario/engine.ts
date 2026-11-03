import type {
  LiveEvent,
  ScenarioPack,
  ScenarioProgress,
  VectorState,
} from './types'

const PROGRESS_KEY = 'markos.scenario.progress'

export function emptyVectors(): VectorState {
  return { programming: 0, hacking_ethical: 0, security: 0, communication: 0 }
}

export function loadProgress(pack: ScenarioPack): ScenarioProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return freshProgress(pack)
    const p = JSON.parse(raw) as ScenarioProgress
    if (p.packId !== pack.id) return freshProgress(pack)
    p.vectors = { ...emptyVectors(), ...p.vectors }
    p.serverAlive = Boolean(p.serverAlive)
    return p
  } catch {
    return freshProgress(pack)
  }
}

export function freshProgress(pack: ScenarioPack): ScenarioProgress {
  return {
    packId: pack.id,
    currentNodeId: pack.startNodeId,
    flags: {},
    vectors: emptyVectors(),
    history: [pack.startNodeId],
    online: false,
    serverAlive: false,
    networkId: null,
    email: null,
  }
}

export function saveProgress(p: ScenarioProgress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
}

export function applyActivity(
  pack: ScenarioPack,
  progress: ScenarioProgress,
  activity: { type: string; networkId?: string; email?: string },
): { progress: ScenarioProgress; events: LiveEvent[]; moved: boolean } {
  const edges = pack.edges.filter((e) => e.from === progress.currentNodeId)
  let edge =
    edges.find(
      (e) =>
        e.when?.activity === activity.type &&
        e.when.networkId &&
        e.when.networkId === activity.networkId,
    ) || edges.find((e) => e.when?.activity === activity.type && !e.when.networkId)

  if (!edge && activity.type === 'network.connected') {
    edge = edges.find((e) => e.when?.activity === 'network.connected' && !e.when.networkId)
  }

  const next: ScenarioProgress = {
    ...progress,
    flags: { ...progress.flags },
    vectors: { ...progress.vectors },
  }
  let events: LiveEvent[] = []
  let moved = false

  if (activity.type === 'network.connected') {
    next.online = true
    next.serverAlive = true
    next.networkId = activity.networkId ?? null
    next.flags.online = true
    next.flags.serverAlive = true
    if (activity.networkId) next.flags.networkId = activity.networkId
  }

  if (activity.type === 'email.created' && activity.email) {
    next.email = activity.email
    next.flags.email = activity.email
  }

  if (edge) {
    const node = pack.nodes.find((n) => n.id === edge!.to)
    next.currentNodeId = edge.to
    next.history = [...next.history, edge.to]
    if (node?.vectorDelta) {
      for (const [k, v] of Object.entries(node.vectorDelta)) {
        const key = k as keyof VectorState
        next.vectors[key] = (next.vectors[key] || 0) + (v || 0)
      }
    }
    moved = true
  }

  if (activity.type === 'network.connected' && !progress.online) {
    events = [...pack.events.onOnline]
  }
  if (activity.type === 'email.created') {
    events = [...(pack.events.onEmailCreated || [])]
  }

  saveProgress(next)
  return { progress: next, events, moved }
}

export function currentHint(pack: ScenarioPack, progress: ScenarioProgress): string {
  const node = pack.nodes.find((n) => n.id === progress.currentNodeId)
  const hint = node?.payload?.hint
  return typeof hint === 'string' ? hint : ''
}
