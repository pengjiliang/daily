/**
 * 评估模块（亮点 3：RAG 评估与回归看板）。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvalCase } from './eval-case.entity.js';
import { EvalResult } from './eval-result.entity.js';
import { EvalRun } from './eval-run.entity.js';
import { EvalSet } from './eval-set.entity.js';
import { EvalController } from './eval.controller.js';
import { EvalService } from './eval.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EvalSet, EvalCase, EvalRun, EvalResult])],
  controllers: [EvalController],
  providers: [EvalService],
  exports: [EvalService],
})
export class EvalModule {}
