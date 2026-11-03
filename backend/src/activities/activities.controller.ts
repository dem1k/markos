import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { ScenarioService } from '../scenario/scenario.service'
import { EventsGateway } from '../events/events.gateway'

@Controller('activities')
export class ActivitiesController {
  constructor(
    private auth: AuthService,
    private scenarios: ScenarioService,
    private gateway: EventsGateway,
  ) {}

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { type: string; networkId?: string; email?: string },
  ) {
    const token = bearer(authorization)
    const user = await this.auth.userFromToken(token)
    if (!user) throw new UnauthorizedException()
    const result = await this.scenarios.applyActivity(user.id, body)
    if (result.events.length) {
      this.gateway.pushToUser(user.token, result.events)
    }
    return {
      events: result.events,
      progress: {
        currentNodeId: result.progress.currentNodeId,
        online: result.progress.online,
        networkId: result.progress.networkId,
        vectors: JSON.parse(result.progress.vectorsJson),
      },
    }
  }
}

function bearer(authorization?: string): string {
  if (!authorization) return ''
  const [kind, token] = authorization.split(' ')
  return kind?.toLowerCase() === 'bearer' ? token : authorization
}
