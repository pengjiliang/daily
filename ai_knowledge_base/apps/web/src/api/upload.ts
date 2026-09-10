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
}

/** @deprecated Use UploadDocument */
export type Document = UploadDocument;

const API_BASE = 'http://localhost:3000';

export const uploadApi = {
  uploadAvatar(formData: FormData) {
    return request.post<{ avatarUrl: string }>('/upload/avatar', formData);
  },

  uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request.post<UploadDocument>('/upload/document', formData);
  },

  listDocuments() {
    return request.get<UploadDocument[]>('/upload/documents');
  },

  deleteDocument(id: number) {
    return request.delete(`/upload/document/${id}`);
  },

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
