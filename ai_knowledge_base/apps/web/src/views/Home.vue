<!--
  主页（核心工作台，组装层）：
  上 = AppHeader；左 = SidebarPanel（三级嵌套菜单）；右 = 主内容区，按 uiStore.mainView 切换
  （chat=聊天 / preview=文档预览 / stats=使用统计 / graph=知识图谱 / settings=模型配置）。
  聊天区使用 v-show 保持挂载，切换视图不丢失会话与流式状态。
  共享状态统一在 useChatStore（stores/chat.ts）与 useUiStore（stores/ui.ts）；
  删除确认与重命名弹窗（左右共用）在本页统一渲染。
-->
<template>
  <div class="home-container">
    <AppHeader />

    <el-container class="main-container" direction="horizontal">
      <SidebarPanel />
      <!-- 聊天主视图：v-show 保持挂载，避免切换视图时丢失会话/流式状态 -->
      <ChatPanel v-show="uiStore.mainView === 'chat'" />
      <el-main v-if="uiStore.mainView === 'preview'" class="content-panel preview-panel">
        <DocumentPreview />
      </el-main>
      <el-main v-if="uiStore.mainView === 'stats'" class="content-panel">
        <StatsPanel />
      </el-main>
      <el-main v-else-if="uiStore.mainView === 'graph'" class="content-panel graph-panel">
        <GraphPanel />
      </el-main>
      <el-main v-else-if="uiStore.mainView === 'settings'" class="content-panel">
        <SettingsPanel />
      </el-main>
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
import DocumentPreview from '@/components/DocumentPreview.vue';
import StatsPanel from '@/views/Stats.vue';
import GraphPanel from '@/views/Graph.vue';
import SettingsPanel from '@/views/Settings.vue';
import { useChatStore } from '@/stores/chat';
import { useUiStore } from '@/stores/ui';

const chatStore = useChatStore();
const uiStore = useUiStore();

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

/* 功能页主区（使用统计 / 模型配置）：浅灰底 + 独立纵向滚动 */
.content-panel {
  flex: 1;
  height: 100%;
  padding: 16px 20px;
  overflow-y: auto;
  background-color: var(--kb-bg-page);
}

/* 知识图谱：无内边距，3D 画布撑满 */
.graph-panel {
  padding: 0;
  overflow: hidden;
  background-color: var(--kb-bg-card);
}

/* 文档预览：无内边距，组件内部撑满 */
.preview-panel {
  padding: 0;
  overflow: hidden;
  background-color: var(--kb-bg-card);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
