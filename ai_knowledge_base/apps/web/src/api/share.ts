/**
 * 文档共享接口：创建/取消共享、我发出的与我收到的共享列表。
 */
import request from './request';

/** 共享权限：read 只读 / edit 可编辑（重命名） */
export type SharePermission = 'read' | 'edit';

/** 共享记录（列表展示）：outgoing 带 shareeUsername，incoming 带 ownerUsername */
export interface ShareRecordView {
  id: number;
  uploadFileId: number;
  permission: SharePermission;
  createdAt: string;
  originalName: string;
  shareeUsername: string;
  ownerUsername: string;
}

export const shareApi = {
  /** 共享一个文档给指定用户名（uploadFileId / shareeUsername / permission） */
  createShare(uploadFileId: number, shareeUsername: string, permission: SharePermission) {
    return request.post<ShareRecordView>('/share', { uploadFileId, shareeUsername, permission });
  },

  /** 我发出的共享列表 */
  listOutgoing() {
    return request.get<ShareRecordView[]>('/share/outgoing');
  },

  /** 我收到的共享列表 */
  listIncoming() {
    return request.get<ShareRecordView[]>('/share/incoming');
  },

  /** 取消共享（仅所有者） */
  removeShare(id: number) {
    return request.delete(`/share/${id}`);
  },
};
