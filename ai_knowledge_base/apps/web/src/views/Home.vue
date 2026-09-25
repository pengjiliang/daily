<!--
  主页（核心工作台，组装层）：
  上 = AppHeader；左 = SidebarPanel（三级嵌套菜单）；右 = 主内容区，按 uiStore.mainView 切换
  （chat=聊天 / preview=文档预览 / stats=使用统计 / graph=知识图谱 / debug=检索调试 / settings=模型配置）。
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
      <el-main v-else-if="uiStore.mainView === 'debug'" class="content-panel">
        <DebugPanel />
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

    <!-- 文档共享对话框（文档管理：把文档共享给其他用户） -->
    <el-dialog
      v-model="chatStore.shareDialogVisible"
      :title="'共享文档：' + (chatStore.shareDialogDoc?.originalName ?? '')"
      width="480px"
      :close-on-click-modal="false"
    >
      <div class="share-form">
        <el-input
          v-model="chatStore.shareDialogUsername"
          placeholder="输入要共享的用户名"
          clearable
          style="flex: 1"
          @keydown.enter="chatStore.addShare"
        />
        <el-radio-group v-model="chatStore.shareDialogPermission">
          <el-radio value="read">只读</el-radio>
          <el-radio value="edit">可编辑</el-radio>
        </el-radio-group>
        <el-button type="primary" :loading="chatStore.sharing" @click="chatStore.addShare">共享</el-button>
      </div>
      <div class="share-list">
        <div v-if="chatStore.shareDialogSharees.length === 0" class="share-empty">尚未共享给任何人</div>
        <div v-for="record in chatStore.shareDialogSharees" :key="record.id" class="share-row">
          <el-tag :type="record.permission === 'edit' ? 'warning' : 'info'" size="small">
            {{ record.permission === 'edit' ? '可编辑' : '只读' }}
          </el-tag>
          <span class="share-user">{{ record.shareeUsername }}</span>
          <el-button text size="small" style="color: var(--el-color-danger)" @click="chatStore.removeShare(record)">
            取消共享
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 粘贴文本导入对话框（文档管理：直接粘贴内容入库为 .txt） -->
    <el-dialog
      v-model="chatStore.pasteDialogVisible"
      title="粘贴文本导入"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-input
        v-model="chatStore.pasteTitle"
        placeholder="标题（可选，留空显示为“粘贴文本”）"
        maxlength="255"
        show-word-limit
        style="margin-bottom: 12px"
      />
      <el-input
        v-model="chatStore.pasteContent"
        type="textarea"
        :rows="12"
        placeholder="把要导入的文本粘贴到这里（最多 20 万字符）"
        maxlength="200000"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="chatStore.pasteDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="chatStore.importingText" @click="chatStore.importText">导入</el-button>
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
import DebugPanel from '@/views/Debug.vue';
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

/* 文档共享对话框 */
.share-form {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.share-list {
  max-height: 280px;
  overflow-y: auto;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}
.share-empty {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}
.share-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.share-user {
  flex: 1;
  font-size: 14px;
}
</style>
