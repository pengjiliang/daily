/**
 * 用量模块（亮点 5：成本与用量看板）。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageEvent } from './usage-event.entity.js';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UsageEvent])],
  controllers: [UsageController],
  providers: [UsageService],
})
export class UsageModule {}
