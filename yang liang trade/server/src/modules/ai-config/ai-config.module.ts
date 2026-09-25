import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { AiConfigController } from './ai-config.controller'
import { AiConfigService } from './ai-config.service'
import { AiConfig } from '../../entities/ai-config.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AiConfig]), AuthModule],
  controllers: [AiConfigController],
  providers: [AiConfigService],
  exports: [AiConfigService]
})
export class AiConfigModule {}
