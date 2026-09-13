/**
 * 全局 axios 实例（供除 SSE 问答外的普通接口使用）：
 * 统一 baseURL 与 30s 超时；请求拦截器自动附带 JWT，
 * 响应拦截器解包 data、统一弹错误提示，并在 401 时登出跳登录页。
 */
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../stores/user';

const request = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 30000, // 问答走独立的 SSE fetch，不受此超时影响
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore();
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

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

export default request;
