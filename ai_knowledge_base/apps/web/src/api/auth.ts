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

export interface LoginResult {
  access_token: string;
  user: UserInfo;
}

export const authApi = {
  register(data: RegisterData) {
    return request.post('/auth/register', data);
  },

  login(data: LoginData) {
    return request.post<LoginResult>('/auth/login', data);
  },

  getProfile() {
    return request.get<UserInfo>('/auth/profile');
  },
};
