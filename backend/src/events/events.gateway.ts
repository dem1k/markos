import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { AuthService } from '../auth/auth.service'
import { ScenarioService } from '../scenario/scenario.service'
import type { LiveEvent } from '../scenario/types'

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  path: '/ws/socket.io',
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server

  private tokenToSocket = new Map<string, string>()

  constructor(
    private auth: AuthService,
    private scenarios: ScenarioService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.query.token as string) ||
      (client.handshake.auth?.token as string) ||
      ''
    const user = await this.auth.userFromToken(token)
    if (!user) {
      client.disconnect(true)
      return
    }
    client.data.token = user.token
    client.data.userId = user.id
    this.tokenToSocket.set(user.token, client.id)
    client.emit('events', { type: 'events', events: [] })
  }

  @SubscribeMessage('activity')
  async onActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { type: string; networkId?: string },
  ) {
    const userId = client.data.userId as string
    if (!userId) return
    const result = await this.scenarios.applyActivity(userId, body)
    if (result.events.length) {
      client.emit('events', { type: 'events', events: result.events })
    }
    return { ok: true, events: result.events }
  }

  @SubscribeMessage('ping')
  ping() {
    return { type: 'pong' }
  }

  pushToUser(token: string, events: LiveEvent[]) {
    const sid = this.tokenToSocket.get(token)
    if (!sid) return
    this.server.to(sid).emit('events', { type: 'events', events })
  }
}
