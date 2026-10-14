/**
 * 鉴权相关接口：注册、登录（服务端写 HttpOnly Cookie）、获取当前用户资料、注销。
 */
import request from './request';

export interface RegisterData {
  username: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  avatarUrl?: string;
}

export const authApi = {
  register(data: RegisterData) {
    return request.post('/auth/register', data);
  },

  login(data: LoginData) {
    return request.post<UserInfo>('/auth/login', data);
  },

  /** 注销：服务端清除登录态 Cookie */
  logout() {
    return request.post<{ loggedOut: boolean }>('/auth/logout');
  },

  getProfile() {
    return request.get<UserInfo>('/auth/profile');
  },
};
