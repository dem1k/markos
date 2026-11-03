import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma.service'
import type { LiveEvent } from '../scenario/types'

@Injectable()
export class AiService {
  private readonly log = new Logger(AiService.name)

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  /** Optional enrichment; falls back to authored events when no key. */
  async maybeEnrichMail(userId: string, events: LiveEvent[]): Promise<LiveEvent[]> {
    const key = this.config.get<string>('AI_API_KEY')
    if (!key) return events

    const out: LiveEvent[] = []
    for (const ev of events) {
      if (ev.type !== 'mail') {
        out.push(ev)
        continue
      }
      try {
        const body = await this.completeMail(ev.payload.subject, ev.payload.body)
        await this.prisma.aiTurn.create({
          data: {
            userId,
            purpose: 'fill_mail',
            prompt: ev.payload.subject,
            response: body,
          },
        })
        out.push({
          type: 'mail',
          payload: { ...ev.payload, body },
        })
      } catch (e) {
        this.log.warn(`AI enrich failed, using fallback: ${String(e)}`)
        out.push(ev)
      }
    }
    return out
  }

  private async completeMail(subject: string, fallback: string): Promise<string> {
    const url = this.config.get<string>('AI_API_URL')
    const key = this.config.get<string>('AI_API_KEY')
    if (!url || !key) return fallback

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You write short kid-safe welcome emails for an educational OS game. No real hacking advice. Max 80 words. Return plain text only.',
          },
          {
            role: 'user',
            content: `Rewrite this mentor mail for subject "${subject}":\n${fallback}`,
          },
        ],
      }),
    })
    if (!res.ok) return fallback
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return data.choices?.[0]?.message?.content?.trim() || fallback
  }
}
