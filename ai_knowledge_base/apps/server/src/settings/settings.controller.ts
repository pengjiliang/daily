/**
 * 设置控制器：GET/PUT /settings（登录后按 userId 隔离）。
 * GET 回显当前生效配置；PUT 保存并可能触发文档重建索引。
 */
import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AiSettingsView } from '@ai-knowledge-base/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { SaveSettingsDto } from './dto/save-settings.dto.js';
import { SettingsService } from './settings.service.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** GET /settings：当前用户的 AI 设置回显（apiKey 仅返回是否已配置） */
  @Get()
  getSettings(@Req() request: AuthenticatedRequest): Promise<AiSettingsView> {
    return this.settingsService.getSettings(request.user.userId);
  }

  /** PUT /settings：保存设置；向量模型变化时自动触发重建索引 */
  @Put()
  saveSettings(@Req() request: AuthenticatedRequest, @Body() dto: SaveSettingsDto): Promise<AiSettingsView> {
    return this.settingsService.saveSettings(request.user.userId, dto);
  }

  /** POST /settings/reindex：手动触发全量重建索引（不改动模型配置） */
  @Post('reindex')
  triggerReindex(@Req() request: AuthenticatedRequest): Promise<AiSettingsView> {
    return this.settingsService.triggerReindex(request.user.userId);
  }
}
