import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(@Req() request: AuthenticatedRequest, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }
    return this.uploadService.saveAvatar(request.user.userId, file);
  }

  @Post('document')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  async uploadDocument(@Req() request: AuthenticatedRequest, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }
    return this.uploadService.saveDocument(request.user.userId, file);
  }

  @Get('documents')
  async listDocuments(@Req() request: AuthenticatedRequest) {
    return this.uploadService.listDocuments(request.user.userId);
  }

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

  @Delete('document/:id')
  async deleteDocument(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.uploadService.deleteDocument(id, request.user.userId);
    return { deleted: true };
  }
}
