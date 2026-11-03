import { Controller, Post, Body, Get, Headers, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { PrismaService } from '../prisma.service'

@Controller()
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('auth/guest')
  guest(@Body() body: { displayName?: string; ageBand?: string }) {
    return this.auth.createGuest(body?.displayName, body?.ageBand)
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const token = bearer(authorization)
    const user = await this.auth.userFromToken(token)
    if (!user) throw new UnauthorizedException()
    return { userId: user.id, displayName: user.displayName, ageBand: user.ageBand }
  }

  @Get('progress')
  async progress(@Headers('authorization') authorization?: string) {
    const token = bearer(authorization)
    const user = await this.auth.userFromToken(token)
    if (!user) throw new UnauthorizedException()
    const progress = await this.prisma.progress.findUnique({ where: { userId: user.id } })
    if (!progress) throw new UnauthorizedException()
    return serializeProgress(progress)
  }

  @Post('progress/sync')
  async sync(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      currentNodeId?: string
      online?: boolean
      networkId?: string | null
      flags?: Record<string, unknown>
      vectors?: Record<string, number>
      history?: string[]
    },
  ) {
    const token = bearer(authorization)
    const user = await this.auth.userFromToken(token)
    if (!user) throw new UnauthorizedException()
    const progress = await this.prisma.progress.update({
      where: { userId: user.id },
      data: {
        currentNodeId: body.currentNodeId,
        online: body.online,
        networkId: body.networkId ?? undefined,
        flagsJson: body.flags ? JSON.stringify(body.flags) : undefined,
        vectorsJson: body.vectors ? JSON.stringify(body.vectors) : undefined,
        historyJson: body.history ? JSON.stringify(body.history) : undefined,
      },
    })
    return serializeProgress(progress)
  }
}

function serializeProgress(progress: {
  packId: string
  currentNodeId: string
  flagsJson: string
  vectorsJson: string
  historyJson: string
  online: boolean
  networkId: string | null
}) {
  return {
    packId: progress.packId,
    currentNodeId: progress.currentNodeId,
    flags: JSON.parse(progress.flagsJson),
    vectors: JSON.parse(progress.vectorsJson),
    history: JSON.parse(progress.historyJson),
    online: progress.online,
    networkId: progress.networkId,
  }
}

function bearer(authorization?: string): string {
  if (!authorization) return ''
  const [kind, token] = authorization.split(' ')
  return kind?.toLowerCase() === 'bearer' ? token : authorization
}
