<!--
  顶部导航栏（上）：应用标题 + 右侧用户信息（用户名、头像下拉：模型配置 / 使用统计 / 知识图谱 / 更换头像 / 退出登录）。
  头像更换弹窗自包含在此组件内（选择图片 → 预览 → 上传 → 刷新 store 用户信息）。
-->
<template>
  <el-header class="header">
    <div class="title">AI 知识库</div>
    <div class="user-info">
      <el-dropdown @command="handleCommand">
        <div class="user-trigger">
          <span class="username">{{ userStore.userInfo?.username }}</span>
          <div class="avatar-wrapper">
            <el-avatar v-if="userStore.userInfo?.avatarUrl" :src="fullAvatarUrl" size="large" />
            <el-avatar v-else size="large" :icon="UserFilled" />
            <div class="avatar-overlay">
              <Upload />
            </div>
          </div>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="settings">
              <el-icon><Setting /></el-icon>
              模型配置
            </el-dropdown-item>
            <el-dropdown-item command="stats">
              <el-icon><DataAnalysis /></el-icon>
              使用统计
            </el-dropdown-item>
            <el-dropdown-item command="graph">
              <el-icon><Connection /></el-icon>
              知识图谱
            </el-dropdown-item>
            <el-dropdown-item command="uploadAvatar" divided>更换头像</el-dropdown-item>
            <el-dropdown-item command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 更换头像对话框 -->
    <el-dialog
      v-model="avatarDialogVisible"
      title="更换头像"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div class="avatar-uploader">
        <div v-if="avatarPreview" class="avatar-preview">
          <img :src="avatarPreview" alt="头像预览" width="200" height="200" />
        </div>
        <div v-else class="avatar-placeholder">
          <el-icon><UserFilled /></el-icon>
        </div>
        <el-upload
          class="avatar-uploader"
          action="#"
          :show-file-list="false"
          :before-upload="beforeAvatarUpload"
          :http-request="handleAvatarUpload"
        >
          <el-button type="primary" style="margin-top: 20px">选择图片</el-button>
        </el-upload>
        <div class="upload-tip">支持 JPG、PNG、GIF，大小不超过 2MB</div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="avatarDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitAvatar">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </el-header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload, UserFilled, Setting, DataAnalysis, Connection } from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';
import { useUiStore } from '@/stores/ui';
import { uploadApi } from '@/api/upload';
import { authApi } from '@/api/auth';

const uiStore = useUiStore();
const userStore = useUserStore();

/** 头像相对路径补全为 server 静态资源绝对地址 */
const fullAvatarUrl = computed(() => {
  if (!userStore.userInfo?.avatarUrl) return '';
  return `http://localhost:3000${userStore.userInfo.avatarUrl}`;
});

// 头像更换弹窗状态
const avatarDialogVisible = ref(false);
const avatarPreview = ref('');
const avatarFile = ref<File | null>(null);

/** 头像选择前置钩子：限制 2MB，并通过 FileReader 生成本地预览（不立即上传） */
const beforeAvatarUpload = (file: File) => {
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    ElMessage.error('头像大小不能超过 2MB');
    return false;
  }
  avatarFile.value = file;
  // 预览
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
  return true;
};

const handleAvatarUpload = (options: { file: File }) => {
  beforeAvatarUpload(options.file);
};

/** 确认更换头像：上传成功后重新拉取资料并刷新 store */
const submitAvatar = async () => {
  if (!avatarFile.value) {
    ElMessage.warning('请先选择一张图片');
    return;
  }
  try {
    const formData = new FormData();
    formData.append('avatar', avatarFile.value);
    await uploadApi.uploadAvatar(formData);
    ElMessage.success('更换头像成功');
    avatarDialogVisible.value = false;
    // 更新 store 中的用户信息
    const profile = await authApi.getProfile();
    userStore.setUserInfo(profile);
  } catch (error) {
    console.error(error);
    ElMessage.error('更换头像失败');
  }
};

/** 顶部用户下拉命令：打开全局功能弹框 / 换头像弹窗 或 登出回登录页 */
const handleCommand = (command: string) => {
  if (command === 'settings') {
    uiStore.openDialog('settings');
  } else if (command === 'stats') {
    uiStore.openDialog('stats');
  } else if (command === 'graph') {
    uiStore.openDialog('graph');
  } else if (command === 'uploadAvatar') {
    avatarDialogVisible.value = true;
    avatarPreview.value = fullAvatarUrl.value || '';
  } else if (command === 'logout') {
    userStore.logout();
    window.location.href = '/login';
  }
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.header .title {
  font-size: 20px;
  font-weight: bold;
  color: #000;
}

.header .user-info {
  display: flex;
  align-items: center;
}

/* 头像 + 用户名整体作为下拉触发区 */
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  font-size: 14px;
  color: #333;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.avatar-uploader {
  text-align: center;
}

.avatar-preview {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 50%;
  margin: 0 auto;
}

.avatar-placeholder {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 30px;
  margin: 0 auto;
}

.upload-tip {
  margin-top: 16px;
  font-size: 12px;
  color: #909399;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
