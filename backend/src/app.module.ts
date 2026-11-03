import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaService } from './prisma.service'
import { AuthService } from './auth/auth.service'
import { AuthController } from './auth/auth.controller'
import { ScenarioService } from './scenario/scenario.service'
import { AiService } from './ai/ai.service'
import { ActivitiesController } from './activities/activities.controller'
import { EventsGateway } from './events/events.gateway'
import { ScenariosController } from './scenario/scenarios.controller'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AuthController, ActivitiesController, ScenariosController],
  providers: [PrismaService, AuthService, ScenarioService, AiService, EventsGateway],
})
export class AppModule {}
