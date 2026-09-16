<!--
  主页（核心工作台，组装层）：
  上 = AppHeader（导航栏/头像）；左 = SidebarPanel（文档管理 + 会话列表）；右 = ChatPanel（聊天区）。
  共享状态统一在 useChatStore（stores/chat.ts）；删除确认与重命名弹窗（左右共用）在本页统一渲染。
-->
<template>
  <div class="home-container">
    <AppHeader />

    <el-container class="main-container" direction="horizontal">
      <SidebarPanel />
      <ChatPanel />
    </el-container>

    <!-- 删除确认对话框（文档/文件夹/会话共用） -->
    <el-dialog
      v-model="chatStore.deleteDialogVisible"
      title="确认删除"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div>
        <el-icon :size="24" color="#e6a23c" style="vertical-align: middle; margin-right: 8px"><Warning /></el-icon>
        <span>{{ chatStore.deleteDialogContent }}</span>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="chatStore.deleteDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="chatStore.confirmDelete">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 重命名对话框（文档/会话共用） -->
    <el-dialog
      v-model="chatStore.renameDialogVisible"
      :title="chatStore.renameDialogTitle"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-input
        v-model="chatStore.renameDialogValue"
        placeholder="请输入新名称"
        maxlength="255"
        show-word-limit
        @keydown.enter="chatStore.confirmRename"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="chatStore.renameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="chatStore.confirmRename">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Warning } from '@element-plus/icons-vue';
import AppHeader from '@/components/AppHeader.vue';
import SidebarPanel from '@/components/SidebarPanel.vue';
import ChatPanel from '@/components/ChatPanel.vue';
import { useChatStore } from '@/stores/chat';

const chatStore = useChatStore();

// 页面初始化：加载文档与会话列表
onMounted(() => {
  chatStore.loadDocuments();
  chatStore.loadConversations();
});
</script>

<style scoped>
.home-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-container {
  flex: 1;
  overflow: hidden;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
