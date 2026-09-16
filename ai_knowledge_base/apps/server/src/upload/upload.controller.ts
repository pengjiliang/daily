/**
 * 上传控制器：头像上传、知识文档上传/列表/下载/删除，全部需要登录（类级 JWT 守卫）。
 * 上传走 multipart/form-data，由 FileInterceptor + upload.storage.ts 中的磁盘存储规则落盘。
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { UploadService } from './upload.service.js';
import { avatarUploadOptions, documentUploadOptions } from './upload.storage.js';

/** 带登录用户信息的请求类型 */
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /** POST /upload/avatar：表单字段名 avatar，上传后更新用户头像 URL */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(@Req() request: AuthenticatedRequest, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }
    return this.uploadService.saveAvatar(request.user.userId, file);
  }

  /** POST /upload/document：表单字段名 file，folderName 可选（文件夹上传时传文件夹相对路径），落库后异步触发 ai-service 建索引 */
  @Post('document')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  async uploadDocument(
    @Req() request: AuthenticatedRequest,
    @Body() body: { folderName?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }
    return this.uploadService.saveDocument(request.user.userId, file, body.folderName);
  }

  /** GET /upload/documents：当前用户上传的文档列表（按上传时间倒序） */
  @Get('documents')
  async listDocuments(@Req() request: AuthenticatedRequest) {
    return this.uploadService.listDocuments(request.user.userId);
  }

  /** GET /upload/document/:id/download：以附件流方式下载自己的文档，文件名走 RFC 5987 编码 */
  @Get('document/:id/download')
  async downloadDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.uploadService.getDocumentDownload(id, request.user.userId);
    const encodedName = encodeURIComponent(file.originalName);

    response.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodedName}`,
    });

    return new StreamableFile(file.stream);
  }

  /** PATCH /upload/document/:id：重命名文档（仅改展示名，不影响磁盘与索引） */
  @Patch('document/:id')
  async renameDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { originalName?: string },
  ) {
    if (!body.originalName?.trim()) {
      throw new BadRequestException('文件名不能为空');
    }
    return this.uploadService.renameDocument(id, request.user.userId, body.originalName);
  }

  /** DELETE /upload/document/:id：删本地文件 + 删库记录 + 通知 ai-service 清向量分块 */
  @Delete('document/:id')
  async deleteDocument(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.uploadService.deleteDocument(id, request.user.userId);
    return { deleted: true };
  }
}
