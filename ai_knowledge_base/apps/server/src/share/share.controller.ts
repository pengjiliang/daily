/**
 * 共享控制器：创建/取消共享、我发出的与我收到的共享列表。全局 JWT 守卫默认生效。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { ShareService, type ShareRecordView } from './share.service.js';
import type { SharePermission } from './share.entity.js';

/** 带登录用户信息的请求类型 */
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /** POST /share：共享一个文档给指定用户名（body: uploadFileId / shareeUsername / permission） */
  @Post()
  createShare(
    @Req() request: AuthenticatedRequest,
    @Body() body: { uploadFileId: number; shareeUsername: string; permission: SharePermission },
  ) {
    return this.shareService.shareDocument(
      request.user.userId,
      body.uploadFileId,
      body.shareeUsername,
      body.permission,
    );
  }

  /** GET /share/outgoing：我发出的共享列表 */
  @Get('outgoing')
  listOutgoing(@Req() request: AuthenticatedRequest): Promise<ShareRecordView[]> {
    return this.shareService.listOutgoing(request.user.userId);
  }

  /** GET /share/incoming：我收到的共享列表 */
  @Get('incoming')
  listIncoming(@Req() request: AuthenticatedRequest): Promise<ShareRecordView[]> {
    return this.shareService.listIncoming(request.user.userId);
  }

  /** DELETE /share/:id：取消共享（仅所有者） */
  @Delete(':id')
  async removeShare(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.shareService.removeShare(request.user.userId, id);
    return { removed: true };
  }
}
