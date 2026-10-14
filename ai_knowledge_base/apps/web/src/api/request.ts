/**
 * 全局 axios 实例（供除 SSE 问答外的普通接口使用）：
 * 统一 baseURL 与 30s 超时；登录态 JWT 在 HttpOnly Cookie 中，
 * withCredentials 让跨源请求自动携带；响应拦截器解包 data、
 * 统一弹错误提示，并在 401 时登出跳登录页。
 */
import axios, { type AxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../stores/user';
import { API_BASE } from './base';

const request = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 问答走独立的 SSE fetch，不受此超时影响
  withCredentials: true, // 携带 HttpOnly 登录态 Cookie
});

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { message, statusCode } = error.response.data;
      ElMessage.error(message || '请求失败');
      if (statusCode === 401) {
        const userStore = useUserStore();
        userStore.logout();
        window.location.href = '/login';
      }
    } else {
      ElMessage.error('网络连接异常');
    }
    return Promise.reject(error);
  },
);

/**
 * 响应拦截器运行时已解包 response.data，这里把类型同步修正：
 * 让 get/post/patch/put/delete 直接返回 Promise<T>（而非 axios 默认的 Promise<AxiosResponse<T>>），
 * 避免调用处出现 AxiosResponse 解包类型错误。
 */
interface TypedRequest {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
}

export default request as unknown as TypedRequest;
