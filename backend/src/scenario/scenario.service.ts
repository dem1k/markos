import { Injectable } from '@nestjs/common'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { LiveEvent, ScenarioPack } from './types'
import { PrismaService } from '../prisma.service'
import { AiService } from '../ai/ai.service'

@Injectable()
export class ScenarioService {
  private pack: ScenarioPack

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {
    const candidates = [
      join(process.cwd(), 'content/scenarios/day1.json'),
      join(__dirname, '../../content/scenarios/day1.json'),
    ]
    const path = candidates.find((p) => {
      try {
        readFileSync(p)
        return true
      } catch {
        return false
      }
    })
    if (!path) throw new Error('day1.json scenario pack not found')
    this.pack = JSON.parse(readFileSync(path, 'utf8')) as ScenarioPack
  }

  getPack(): ScenarioPack {
    return this.pack
  }

  async ensureProgress(userId: string) {
    let progress = await this.prisma.progress.findUnique({ where: { userId } })
    if (!progress) {
      progress = await this.prisma.progress.create({
        data: {
          userId,
          packId: this.pack.id,
          currentNodeId: this.pack.startNodeId,
          historyJson: JSON.stringify([this.pack.startNodeId]),
        },
      })
    }
    return progress
  }

  async applyActivity(
    userId: string,
    activity: { type: string; networkId?: string; email?: string },
  ): Promise<{ events: LiveEvent[]; progress: Awaited<ReturnType<PrismaService['progress']['findUniqueOrThrow']>> }> {
    const progress = await this.ensureProgress(userId)
    await this.prisma.activity.create({
      data: {
        userId,
        type: activity.type,
        payloadJson: JSON.stringify(activity),
      },
    })

    const edges = this.pack.edges.filter((e) => e.from === progress.currentNodeId)
    let edge =
      edges.find(
        (e) =>
          e.when?.activity === activity.type &&
          e.when.networkId &&
          e.when.networkId === activity.networkId,
      ) || edges.find((e) => e.when?.activity === activity.type && !e.when.networkId)

    const wasOffline = !progress.online
    let currentNodeId = progress.currentNodeId
    let history = JSON.parse(progress.historyJson) as string[]
    let vectors = JSON.parse(progress.vectorsJson) as Record<string, number>
    const flags = JSON.parse(progress.flagsJson) as Record<string, unknown>
    let online = progress.online
    let networkId = progress.networkId

    if (activity.type === 'network.connected') {
      online = true
      networkId = activity.networkId ?? null
      flags.online = true
      if (activity.networkId) flags.networkId = activity.networkId
    }
    if (activity.type === 'email.created' && activity.email) {
      flags.email = activity.email
    }

    if (edge) {
      currentNodeId = edge.to
      history = [...history, edge.to]
      const node = this.pack.nodes.find((n) => n.id === edge!.to)
      if (node?.vectorDelta) {
        for (const [k, v] of Object.entries(node.vectorDelta)) {
          vectors[k] = (vectors[k] || 0) + (v || 0)
        }
      }
    }

    const updated = await this.prisma.progress.update({
      where: { userId },
      data: {
        currentNodeId,
        historyJson: JSON.stringify(history),
        vectorsJson: JSON.stringify(vectors),
        flagsJson: JSON.stringify(flags),
        online,
        networkId,
      },
    })

    let events: LiveEvent[] = []
    if (activity.type === 'network.connected' && wasOffline) {
      events = await this.buildOnlineEvents(userId)
    }
    if (activity.type === 'email.created') {
      events = [...(this.pack.events.onEmailCreated || [])]
    }
    for (const ev of events) {
      await this.prisma.liveEvent.create({
        data: {
          userId,
          type: ev.type,
          payloadJson: JSON.stringify(ev.payload),
        },
      })
    }

    return { events, progress: updated }
  }

  private async buildOnlineEvents(userId: string): Promise<LiveEvent[]> {
    const base = [...this.pack.events.onOnline]
    return this.ai.maybeEnrichMail(userId, base)
  }
}
