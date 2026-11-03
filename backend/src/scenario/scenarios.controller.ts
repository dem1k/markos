import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { ScenarioService } from './scenario.service'

@Controller('scenarios')
export class ScenariosController {
  constructor(private scenarios: ScenarioService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    const pack = this.scenarios.getPack()
    if (pack.id !== id) throw new NotFoundException()
    return pack
  }
}
