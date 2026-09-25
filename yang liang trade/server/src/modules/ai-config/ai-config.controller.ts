import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { AiConfigService, AiConfigDto } from './ai-config.service'

@Controller('ai-config')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  constructor(private service: AiConfigService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Post()
  create(@Body() dto: AiConfigDto) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<AiConfigDto>) {
    return this.service.update(Number(id), dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id))
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string) {
    return this.service.setDefault(Number(id))
  }
}
