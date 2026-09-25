/**
 * 共享服务：文档「创建共享 / 我发出的 / 我收到的 / 取消共享」与权限判断。
 * - 创建与取消只允许文档所有者操作；被共享用户可检索/预览/下载（只读）或额外重命名（可编辑）；
 * - 检索侧：ai-service 的检索 SQL 会把 share_records 纳入（共享给当前用户的文档可被命中）；
 * - listSharedUploadFiles 供 UploadService 组合「我的 + 共享给我的」文档列表。
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadFile } from '../upload/upload-file.entity.js';
import { UsersService } from '../users/users.service.js';
import { ShareRecord, type SharePermission } from './share.entity.js';

/** 列表展示用的共享记录：附文档名与被共享人/共享者用户名 */
export interface ShareRecordView {
  id: number;
  uploadFileId: number;
  permission: SharePermission;
  createdAt: Date;
  originalName: string;
  shareeUsername: string;
  ownerUsername: string;
}

/** 共享给我的文档：upload_files 字段 + 共享来源信息 */
export type SharedUploadFile = UploadFile & {
  sharedByUsername: string;
  sharedPermission: SharePermission;
};

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(ShareRecord)
    private readonly shareRepository: Repository<ShareRecord>,
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    private readonly usersService: UsersService,
  ) {}

  /** 创建/更新共享：校验文档归属 + 被共享人存在且非本人；已存在则更新权限（合并写） */
  async shareDocument(
    ownerId: number,
    uploadFileId: number,
    shareeUsername: string,
    permission: SharePermission,
  ): Promise<ShareRecord> {
    const uploadFile = await this.uploadFilesRepository.findOneBy({ id: uploadFileId });
    if (!uploadFile) {
      throw new NotFoundException('Document not found');
    }
    if (uploadFile.uploaderId !== ownerId) {
      throw new ForbiddenException('You can only share your own documents');
    }

    const sharee = await this.usersService.findOneByUsername(shareeUsername.trim());
    if (!sharee) {
      throw new NotFoundException('用户不存在');
    }
    if (sharee.id === ownerId) {
      throw new BadRequestException('不能共享给自己');
    }

    const perm: SharePermission = permission === 'edit' ? 'edit' : 'read';
    const existing = await this.shareRepository.findOneBy({ uploadFileId, shareeId: sharee.id });
    if (existing) {
      existing.permission = perm;
      return this.shareRepository.save(existing);
    }
    return this.shareRepository.save(
      this.shareRepository.create({ uploadFileId, ownerId, shareeId: sharee.id, permission: perm }),
    );
  }

  /** 我发出的共享（附文档名与被共享人用户名），按创建时间倒序 */
  listOutgoing(ownerId: number): Promise<ShareRecordView[]> {
    return this.listShares('s."ownerId" = :id', { id: ownerId });
  }

  /** 我收到的共享（附文档名与共享者用户名） */
  listIncoming(shareeId: number): Promise<ShareRecordView[]> {
    return this.listShares('s."shareeId" = :id', { id: shareeId });
  }

  /** 取消共享：仅文档所有者可操作 */
  async removeShare(ownerId: number, shareId: number): Promise<void> {
    const record = await this.shareRepository.findOneBy({ id: shareId });
    if (!record) {
      throw new NotFoundException('Share not found');
    }
    if (record.ownerId !== ownerId) {
      throw new ForbiddenException('You can only remove shares you created');
    }
    await this.shareRepository.remove(record);
  }

  /** 文档删除时清掉其全部共享记录（由 UploadService 调用） */
  async removeSharesForDocument(uploadFileId: number): Promise<void> {
    await this.shareRepository.delete({ uploadFileId });
  }

  /** 共享给我的文档列表（供 UploadService 合并「我的 + 共享」） */
  async listSharedUploadFiles(shareeId: number): Promise<SharedUploadFile[]> {
    const rows = (await this.shareRepository
      .createQueryBuilder('s')
      .select([
        'f.id AS id',
        'f.filename AS filename',
        'f."originalName" AS "originalName"',
        'f."folderName" AS "folderName"',
        'f."mimeType" AS "mimeType"',
        'f.path AS path',
        'f.size AS size',
        'f."uploaderId" AS "uploaderId"',
        'f."createdAt" AS "createdAt"',
        'u.username AS "sharedByUsername"',
        's.permission AS "sharedPermission"',
      ])
      .leftJoin('upload_files', 'f', 'f.id = s."uploadFileId"')
      .leftJoin('users', 'u', 'u.id = s."ownerId"')
      .where('s."shareeId" = :shareeId', { shareeId })
      .andWhere('f.id IS NOT NULL')
      .orderBy('s.id', 'DESC')
      .getRawMany()) as SharedUploadFile[];
    return rows;
  }

  /** 当前用户是否可读取该文档（所有者或任一共享接收者） */
  async hasReadAccess(uploadFileId: number, userId: number): Promise<boolean> {
    const uploadFile = await this.uploadFilesRepository.findOneBy({ id: uploadFileId });
    if (uploadFile?.uploaderId === userId) {
      return true;
    }
    const count = await this.shareRepository.count({ where: { uploadFileId, shareeId: userId } });
    return count > 0;
  }

  /** 当前用户是否可编辑（重命名）该文档：所有者，或拥有 edit 权限的共享接收者 */
  async hasEditAccess(uploadFileId: number, userId: number): Promise<boolean> {
    const uploadFile = await this.uploadFilesRepository.findOneBy({ id: uploadFileId });
    if (uploadFile?.uploaderId === userId) {
      return true;
    }
    const count = await this.shareRepository.count({
      where: { uploadFileId, shareeId: userId, permission: 'edit' },
    });
    return count > 0;
  }

  /** 通用列表查询：联查文档名与双方用户名 */
  private async listShares(
    whereSql: string,
    params: Record<string, unknown>,
  ): Promise<ShareRecordView[]> {
    return (await this.shareRepository
      .createQueryBuilder('s')
      .select([
        's.id AS id',
        's."uploadFileId" AS "uploadFileId"',
        's.permission AS permission',
        's."createdAt" AS "createdAt"',
        'f."originalName" AS "originalName"',
        'u1.username AS "shareeUsername"',
        'u2.username AS "ownerUsername"',
      ])
      .leftJoin('upload_files', 'f', 'f.id = s."uploadFileId"')
      .leftJoin('users', 'u1', 'u1.id = s."shareeId"')
      .leftJoin('users', 'u2', 'u2.id = s."ownerId"')
      .where(whereSql, params)
      .orderBy('s.id', 'DESC')
      .getRawMany()) as ShareRecordView[];
  }
}
