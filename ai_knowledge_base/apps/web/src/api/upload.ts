/**
 * 上传相关接口：头像上传、知识文档上传/列表/删除/下载。
 * 普通操作走全局 axios；下载因需要 blob 响应并手动触发浏览器保存，单独使用原生 axios。
 */
import request from './request';
import axios from 'axios';
import { useUserStore } from '../stores/user';
import { ElMessage } from 'element-plus';

export interface UploadDocument {
  id: number;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  indexed: boolean;
  /** 所属文件夹相对路径（如 `2026/文档`）；单文件上传为 null/undefined */
  folderName?: string | null;
  /** 共享来源：null=自己上传；非空=他人共享给我的文档（值为共享者用户名） */
  sharedByUsername?: string | null;
  /** 共享权限（仅共享给我的文档有值） */
  sharedPermission?: 'read' | 'edit' | null;
}

/** @deprecated Use UploadDocument */
export type Document = UploadDocument;

const API_BASE = 'http://localhost:3000';

export const uploadApi = {
  uploadAvatar(formData: FormData) {
    return request.post<{ avatarUrl: string }>('/upload/avatar', formData);
  },

  /**
   * 上传单个文档。folderName 可选：文件夹上传时传入文件夹相对路径（如 `2026/文档`），
   * 作为独立表单字段交给服务端存入 upload_files.folderName，用于前端分组展示；单文件上传不传。
   */
  uploadDocument(file: File, folderName?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (folderName) {
      formData.append('folderName', folderName);
    }
    return request.post<UploadDocument>('/upload/document', formData);
  },

  /** 粘贴文本导入（多源导入·文本源）：title 可选、content 必填，服务端落为 .txt 并异步建索引 */
  importTextDocument(title: string, content: string) {
    return request.post<UploadDocument>('/upload/document/text', { title, content });
  },

  listDocuments() {
    return request.get<UploadDocument[]>('/upload/documents');
  },

  deleteDocument(id: number) {
    return request.delete(`/upload/document/${id}`);
  },

  /**
   * 获取文档原始 blob（带 JWT 认证），供在线预览等场景使用
   */
  async fetchDocumentBlob(id: number): Promise<Blob> {
    const userStore = useUserStore();
    const response = await axios.get(`${API_BASE}/upload/document/${id}/download`, {
      responseType: 'blob',
      headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : undefined,
    });
    return response.data;
  },

  /** 重命名文档（仅改展示名，不影响磁盘文件与向量索引） */
  renameDocument(id: number, originalName: string) {
    return request.patch<UploadDocument>(`/upload/document/${id}`, { originalName });
  },

  /**
   * 下载文档为 blob 并用隐藏 <a> 触发浏览器保存。
   * 文件名优先取 Content-Disposition 中的 filename*（UTF-8 编码中文），其次普通 filename，最后兜底。
   */
  async downloadDocument(id: number, fallbackName?: string) {
    const userStore = useUserStore();
    try {
      const response = await axios.get(`${API_BASE}/upload/document/${id}/download`, {
        responseType: 'blob',
        headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : undefined,
      });

      const disposition = response.headers['content-disposition'] as string | undefined;
      let filename = fallbackName || `document-${id}`;
      if (disposition) {
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
        if (utf8Match?.[1]) {
          filename = decodeURIComponent(utf8Match[1]);
        } else if (plainMatch?.[1] && plainMatch[1] !== 'download') {
          filename = plainMatch[1];
        }
      }

      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      ElMessage.error('文件下载失败');
      throw error;
    }
  },
};
