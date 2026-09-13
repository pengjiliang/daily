/**
 * 用户状态（Pinia）：保存 JWT 与用户信息，并同步持久化到 localStorage，
 * 刷新页面后自动恢复登录态；提供登录写入、头像更新与登出清理。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface UserInfo {
  id: number;
  username: string;
  avatarUrl?: string;
}

export const useUserStore = defineStore('user', () => {
  // 初始值直接从 localStorage 恢复，实现刷新免登录
  const token = ref<string>(localStorage.getItem('token') || '');
  const userInfo = ref<UserInfo | null>(
    localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')!) : null,
  );

  /** 是否已登录（仅以 token 有无判定） */
  const isLoggedIn = computed(() => !!token.value);

  /** 写入 token：更新响应式状态并持久化 */
  function setToken(newToken: string) {
    token.value = newToken;
    localStorage.setItem('token', newToken);
  }

  /** 写入用户信息并持久化 */
  function setUserInfo(info: UserInfo) {
    userInfo.value = info;
    localStorage.setItem('userInfo', JSON.stringify(info));
  }

  /** 更新头像 URL 并同步持久化（上传头像后调用） */
  function updateAvatar(avatarUrl: string) {
    if (userInfo.value) {
      userInfo.value.avatarUrl = avatarUrl;
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value));
    }
  }

  /** 登出：清空内存状态与本地缓存 */
  function logout() {
    token.value = '';
    userInfo.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    setToken,
    setUserInfo,
    updateAvatar,
    logout,
  };
});
