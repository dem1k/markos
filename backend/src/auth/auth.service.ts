import { Injectable } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma.service'
import { ScenarioService } from '../scenario/scenario.service'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private scenarios: ScenarioService,
  ) {}

  async createGuest(displayName = 'Guest', ageBand = 'kid') {
    const token = randomBytes(24).toString('hex')
    const user = await this.prisma.user.create({
      data: { token, displayName, ageBand },
    })
    await this.scenarios.ensureProgress(user.id)
    return { token: user.token, userId: user.id, displayName: user.displayName, ageBand: user.ageBand }
  }

  async userFromToken(token: string) {
    if (!token) return null
    return this.prisma.user.findUnique({ where: { token } })
  }
}
