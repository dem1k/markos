import { io, Socket } from 'socket.io-client'
import type { LiveEvent } from './types'

const apiBase = () => (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || ''

export function apiConfigured(): boolean {
  return Boolean(apiBase())
}

/** Probe backend — Wi-Fi "really works" only if server answers. */
export async function probeServerAlive(): Promise<boolean> {
  const base = apiBase()
  if (!base) {
    try {
      const res = await fetch('http://127.0.0.1:3001/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      return res.ok
    } catch {
      return false
    }
  }
  try {
    const res = await fetch(`${base}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    return res.ok
  } catch {
    return false
  }
}

export async function guestAuth(): Promise<{ token: string; userId: string } | null> {
  const base = apiBase() || 'http://127.0.0.1:3001'
  try {
    const res = await fetch(`${base}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return null
    return (await res.json()) as { token: string; userId: string }
  } catch {
    return null
  }
}

export type LivePushHandler = (events: LiveEvent[]) => void

export function connectLive(
  token: string,
  onEvent: LivePushHandler,
): { sendActivity: (a: { type: string; networkId?: string }) => void; close: () => void } {
  const base = apiBase() || 'http://127.0.0.1:3001'

  let socket: Socket | null = null
  try {
    socket = io(base, {
      path: '/ws/socket.io',
      query: { token },
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socket.on('events', (data: { type?: string; events?: LiveEvent[]; payload?: LiveEvent }) => {
      if (data?.payload) onEvent([data.payload])
      if (data?.events?.length) onEvent(data.events)
    })
    socket.on('event', (data: LiveEvent) => onEvent([data]))
  } catch {
    return { sendActivity: () => undefined, close: () => undefined }
  }

  return {
    sendActivity: (a) => {
      socket?.emit('activity', a)
    },
    close: () => {
      socket?.close()
      socket = null
    },
  }
}

export async function postActivity(
  token: string,
  activity: { type: string; networkId?: string; email?: string },
): Promise<LiveEvent[]> {
  const base = apiBase() || 'http://127.0.0.1:3001'
  try {
    const res = await fetch(`${base}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(activity),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { events?: LiveEvent[] }
    return data.events || []
  } catch {
    return []
  }
}
