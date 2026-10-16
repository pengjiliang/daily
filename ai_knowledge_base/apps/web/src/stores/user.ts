/**
 * 用户状态（Pinia）：登录态 JWT 存放在服务端下发的 HttpOnly Cookie 中（前端不可读），
 * 这里只保存用户信息；刷新页面后通过 /auth/profile 恢复登录态。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface UserInfo {
  id: number;
  username: string;
  avatarUrl?: string;
}

export const useUserStore = defineStore('user', () => {
  // 登录态由 HttpOnly Cookie 承载；是否已登录以最近一次 profile 校验为准
  const userInfo = ref<UserInfo | null>(null);
  const authChecked = ref(false);

  /** 是否已登录：完成过一次校验且拿到了用户信息 */
  const isLoggedIn = computed(() => authChecked.value && userInfo.value !== null);

  /** 写入用户信息（登录成功或 profile 校验通过后调用） */
  function setUserInfo(info: UserInfo) {
    userInfo.value = info;
    authChecked.value = true;
  }

  /** 更新头像 URL 并同步持久化（上传头像后调用） */
  function updateAvatar(avatarUrl: string) {
    if (userInfo.value) {
      userInfo.value.avatarUrl = avatarUrl;
    }
  }

  /** 登出：清空内存状态（Cookie 由服务端清除） */
  function logout() {
    userInfo.value = null;
    authChecked.value = false;
  }

  /** 标记登录态已校验过（无论是否登录），用于避免重复请求 profile */
  function markChecked() {
    authChecked.value = true;
  }

  return {
    userInfo,
    authChecked,
    isLoggedIn,
    setUserInfo,
    updateAvatar,
    logout,
    markChecked,
  };
});
