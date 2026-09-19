/**
 * 聊天工作台共享状态（Pinia）：
 * Home 拆分后（AppHeader / SidebarPanel / ChatPanel），把跨组件共享的状态与领域操作集中在这里：
 * 文档列表、会话列表、当前会话与消息、左右两侧联动（来源定位到文档）、删除/重命名弹窗、上传等。
 * 聊天区专属的流式发送逻辑（sendQuestion/停止生成/来源展示）保留在 ChatPanel 内部。
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { chatApi } from '@/api/chat';
import { uploadApi } from '@/api/upload';
import type { Conversation, Message } from '@/api/chat';
import type { UploadDocument } from '@/api/upload';
import type { WorkBook } from 'xlsx';
import { useUiStore } from '@/stores/ui';

export const useChatStore = defineStore('chat', () => {
  // ---- 共享状态 ----

  /** 左侧 AI 助手子菜单：文档管理 / 会话列表（空串表示收起列表区），默认展开会话列表 */
  const activeTab = ref<'documents' | 'conversations' | ''>('conversations');
  const loadingDocuments = ref(false);
  const documents = ref<UploadDocument[]>([]);
  const conversations = ref<Conversation[]>([]);
  const currentConversation = ref<Conversation | null>(null);
  const messages = ref<Message[]>([]);
  /** 已展开的文件夹名集合（点击文件夹行切换展开/收起） */
  const expandedFolders = ref<Set<string>>(new Set());
  /** 来源定位高亮：文档列表中临时高亮的文件 id */
  const highlightedDocumentId = ref<number | null>(null);

  // 删除确认弹窗（文档/会话共用，回调区分动作）
  const deleteDialogVisible = ref(false);
  const deleteDialogContent = ref('');
  const deleteConfirmCallback = ref<(() => void) | null>(null);
  // 重命名弹窗（文档/会话共用）
  const renameDialogVisible = ref(false);
  const renameDialogTitle = ref('');
  const renameDialogValue = ref('');
  const renameConfirmCallback = ref<(() => void) | null>(null);

  // 文件夹上传
  const uploadingFolder = ref(false);

  // ---- 文档预览（右侧内容区）----
  /** 当前预览状态：kind=image/pdf 用 objectURL 渲染；html 为转换后的内容；unsupported 提示下载 */
  const previewState = ref<{
    id: number;
    originalName: string;
    ext: string;
    kind: 'image' | 'pdf' | 'html' | 'unsupported';
    url: string | null;
    html: string | null;
  } | null>(null);
  const previewLoading = ref(false);

  // ---- 工具函数 ----

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  /** 取文件扩展名（小写含点），与 node:path extname 行为一致（浏览器环境不引入 node 模块） */
  const getExtension = (name: string) => {
    const dotIndex = name.lastIndexOf('.');
    const slashIndex = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
    return dotIndex > slashIndex ? name.slice(dotIndex).toLowerCase() : '';
  };

  /** 由完整相对路径（`2026/文档/报告.pdf`）算出所属文件夹路径（`2026/文档`）；无路径返回空串 */
  const extractFolderName = (relativePath: string) => {
    const slashIndex = Math.max(relativePath.lastIndexOf('/'), relativePath.lastIndexOf('\\'));
    return slashIndex > 0 ? relativePath.slice(0, slashIndex) : '';
  };

  /** HTML 转义（预览文本/表格时防止 XSS 与样式破坏） */
  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  /**
   * 轻量 Markdown → HTML 渲染（先转义再按行/块转换，覆盖标题、代码块、引用、
   * 列表、加粗/斜体、行内代码、链接、分隔线与换行；不含高级语法）。
   */
  const renderMarkdown = (raw: string) => {
    let html = escapeHtml(raw);
    // 代码块（先处理，避免内部语法被二次转换）
    html = html.replace(/```([\s\S]*?)```/g, (_match, code: string) => `<pre class="md-code">${code.trim()}</pre>`);
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // 标题
    html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    // 加粗 / 斜体
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    // 链接
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // 引用 / 分隔线
    html = html.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^---$/gm, '<hr />');
    // 无序 / 有序列表
    html = html.replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/^\s*\d+\. (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ol>$&</ol>');
    // 段落与换行
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = html.replace(/\n/g, '<br />');
    return `<p>${html}</p>`;
  };

  /** 支持扩展名白名单（与 server upload.storage.ts 保持一致） */
  const ALLOWED_DOC_EXTENSIONS = new Set([
    '.pdf',
    '.txt',
    '.xls',
    '.xlx',
    '.xlsx',
    '.csv',
    '.md',
    '.docx',
    '.doc',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.tiff',
    '.tif',
  ]);
  /** 图片类扩展名：objectURL 后用 <img> 直接渲染 */
  const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif']);
  /** 文本/Office 类扩展名：转成 HTML 后渲染（旧版 .doc 二进制无法解析，仅提示下载） */
  const HTML_EXTENSIONS = new Set(['.txt', '.md', '.docx', '.xlsx', '.xls', '.xlx', '.csv']);
  /** 文件夹上传并发数（避免同时发起过多请求） */
  const FOLDER_UPLOAD_CONCURRENCY = 3;

  // ---- 数据加载 ----

  const loadDocuments = async () => {
    loadingDocuments.value = true;
    try {
      const res = await uploadApi.listDocuments();
      documents.value = res;
    } catch (error) {
      console.error(error);
      ElMessage.error('加载文档列表失败');
    } finally {
      loadingDocuments.value = false;
    }
  };

  const loadConversations = async () => {
    try {
      const res = await chatApi.listConversations();
      conversations.value = res;
    } catch (error) {
      console.error(error);
      ElMessage.error('加载对话列表失败');
    }
  };

  const loadMessages = async () => {
    if (!currentConversation.value) return;
    try {
      const res = await chatApi.listMessages(currentConversation.value.id);
      messages.value = res;
    } catch (error) {
      console.error(error);
      ElMessage.error('加载消息失败');
    }
  };

  /** 创建新对话：插入列表并切换为当前会话 */
  const createNewConversation = async () => {
    try {
      const res = await chatApi.createConversation();
      conversations.value.unshift(res);
      currentConversation.value = res;
      messages.value = [];
    } catch (error) {
      console.error(error);
      ElMessage.error('创建对话失败');
    }
  };

  /** 选择会话：切换当前会话并加载消息（滚动由 ChatPanel 监听 messages 处理） */
  const selectConversation = (conv: Conversation) => {
    currentConversation.value = conv;
    loadMessages();
  };

  // ---- 删除弹窗（通用）：文档/会话/批量删除共用 ----

  const openDeleteDialog = (content: string, callback: () => void) => {
    deleteDialogContent.value = content;
    deleteConfirmCallback.value = callback;
    deleteDialogVisible.value = true;
  };

  const confirmDelete = () => {
    const callback = deleteConfirmCallback.value;
    deleteDialogVisible.value = false;
    deleteConfirmCallback.value = null;
    callback?.();
  };

  // 文档删除
  const confirmDeleteDocument = (row: UploadDocument) => {
    openDeleteDialog(`确定要删除文档 "${row.originalName}" 吗？删除后无法恢复。`, () => {
      deleteDocument(row.id);
    });
  };

  const deleteDocument = async (id: number) => {
    try {
      await uploadApi.deleteDocument(id);
      ElMessage.success('删除成功');
      loadDocuments();
    } catch (error) {
      console.error(error);
      ElMessage.error('删除失败');
    }
  };

  /** 并发删除一批文档（复用单文件删除接口），刷新列表并汇总提示 */
  const deleteBulkDocuments = async (files: UploadDocument[], label: string) => {
    let success = 0;
    let failed = 0;
    await Promise.all(
      files.map(async (doc) => {
        try {
          await uploadApi.deleteDocument(doc.id);
          success += 1;
        } catch (error) {
          console.error(`删除失败: ${doc.originalName}`, error);
          failed += 1;
        }
      }),
    );
    await loadDocuments();
    if (failed > 0) {
      ElMessage.error(`${label}删除完成：成功 ${success} 个，失败 ${failed} 个`);
    } else {
      ElMessage.success(`${label}删除完成（${success} 个文件）`);
    }
  };

  // 会话删除
  const confirmDeleteConversation = (conv: Conversation) => {
    openDeleteDialog('确定要删除这个对话吗？删除后无法恢复。', () => {
      deleteConversation(conv.id);
    });
  };

  const deleteConversation = async (id: number) => {
    try {
      await chatApi.deleteConversation(id);
      ElMessage.success('删除成功');
      conversations.value = conversations.value.filter((c) => c.id !== id);
      if (currentConversation.value?.id === id) {
        currentConversation.value = null;
        messages.value = [];
      }
    } catch (error) {
      console.error(error);
      ElMessage.error('删除失败');
    }
  };

  /** 一键删除全部会话（确认后并发删除），删除后清空当前会话视图 */
  const confirmDeleteAllConversations = () => {
    if (conversations.value.length === 0) return;
    openDeleteDialog(`确定要删除全部 ${conversations.value.length} 个会话吗？删除后无法恢复。`, () => {
      deleteAllConversations();
    });
  };

  const deleteAllConversations = async () => {
    let success = 0;
    let failed = 0;
    await Promise.all(
      conversations.value.map(async (conv) => {
        try {
          await chatApi.deleteConversation(conv.id);
          success += 1;
        } catch (error) {
          console.error(`删除会话失败: ${conv.id}`, error);
          failed += 1;
        }
      }),
    );
    conversations.value = [];
    currentConversation.value = null;
    messages.value = [];
    if (failed > 0) {
      ElMessage.error(`会话删除完成：成功 ${success} 个，失败 ${failed} 个`);
    } else {
      ElMessage.success(`已删除全部会话（${success} 个）`);
    }
  };

  // ---- 重命名弹窗（通用）：文档/会话共用 ----

  const openRenameDialog = (title: string, initialValue: string, callback: () => void) => {
    renameDialogTitle.value = title;
    renameDialogValue.value = initialValue;
    renameConfirmCallback.value = callback;
    renameDialogVisible.value = true;
  };

  const confirmRename = () => {
    const callback = renameConfirmCallback.value;
    renameDialogVisible.value = false;
    renameConfirmCallback.value = null;
    callback?.();
  };

  /** 打开文档重命名弹窗（预填旧名） */
  const openRenameDocumentDialog = (doc: UploadDocument) => {
    openRenameDialog('重命名文档', doc.originalName, async () => {
      const name = renameDialogValue.value.trim();
      if (!name) {
        ElMessage.warning('文件名不能为空');
        return;
      }
      try {
        await uploadApi.renameDocument(doc.id, name);
        ElMessage.success('重命名成功');
        loadDocuments();
      } catch (error) {
        console.error(error);
        ElMessage.error('重命名失败');
      }
    });
  };

  /** 打开会话重命名弹窗（预填当前标题） */
  const openRenameConversationDialog = (conv: Conversation) => {
    openRenameDialog('重命名会话', conv.title || '新对话', async () => {
      const title = renameDialogValue.value.trim();
      if (!title) {
        ElMessage.warning('会话标题不能为空');
        return;
      }
      try {
        const updated = await chatApi.renameConversation(conv.id, title);
        // 同步更新列表与当前会话的标题
        const index = conversations.value.findIndex((c) => c.id === conv.id);
        if (index >= 0) {
          conversations.value[index] = { ...conversations.value[index], ...updated };
        }
        if (currentConversation.value?.id === conv.id) {
          currentConversation.value = { ...currentConversation.value, ...updated };
        }
        ElMessage.success('已重命名');
      } catch (error) {
        console.error(error);
        ElMessage.error('重命名失败');
      }
    });
  };

  // ---- 上传 ----

  /** el-upload 前置钩子：前端先做 10MB 大小限制（服务端另有 20MB 白名单校验） */
  const beforeUpload = (file: File) => {
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      ElMessage.error('文件大小不能超过 10MB');
      return false;
    }
    return true;
  };

  /** 手动上传文档（:auto-upload 走自定义请求），成功后刷新列表（索引在服务端异步进行） */
  const handleUpload = async (options: { file: File }) => {
    try {
      await uploadApi.uploadDocument(options.file);
      ElMessage.success('上传成功，正在索引文档');
      loadDocuments();
    } catch (error) {
      console.error(error);
      ElMessage.error('上传失败');
    }
  };

  /**
   * 文件夹选择（File System Access API 路径）：递归遍历目录树生成 folderName 并上传。
   * 不支持该 API 时由 SidebarPanel 回退到 webkitdirectory 原生 input（本地 folderInput ref）。
   */
  const pickFolderWithPicker = async () => {
    const picker = (window as unknown as { showDirectoryPicker?: (opts?: { mode?: string }) => Promise<unknown> })
      .showDirectoryPicker;
    if (typeof picker !== 'function') return;
    try {
      const handle = await picker({ mode: 'read' });
      const items: { file: File; folderName: string }[] = [];
      // 递归遍历目录树：folderName = 文件夹名 + 子路径（如 `资料/2026`），不包含文件名
      const walk = async (dirHandle: any, prefix: string) => {
        for await (const [name, entry] of dirHandle.entries()) {
          if (entry.kind === 'directory') {
            await walk(entry, `${prefix}${name}/`);
          } else if (entry.kind === 'file') {
            items.push({ file: await entry.getFile(), folderName: prefix.slice(0, -1) });
          }
        }
      };
      await walk(handle, `${(handle as { name?: string }).name ?? '文件夹'}/`);
      await uploadFolderFiles(items);
    } catch (error) {
      // AbortError = 用户取消选择，不提示
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        ElMessage.error('读取文件夹失败');
      }
    }
  };

  /**
   * 上传文件夹内所有文件：过滤白名单扩展名 + 10MB 上限，
   * 以独立 folderName 字段（含文件夹名与子路径）逐个复用单文件上传接口
   * （并发 FOLDER_UPLOAD_CONCURRENCY），结束后汇总提示并刷新文档列表（索引在服务端异步进行）。
   */
  const uploadFolderFiles = async (items: { file: File; folderName: string }[]) => {
    const valid = items.filter(
      ({ file }) => ALLOWED_DOC_EXTENSIONS.has(getExtension(file.name)) && file.size / 1024 / 1024 < 10,
    );
    const skipped = items.length - valid.length;
    if (valid.length === 0) {
      ElMessage.warning(`文件夹内没有可上传的文档（跳过 ${skipped} 个不支持格式或超 10MB 的文件）`);
      return;
    }

    uploadingFolder.value = true;
    let success = 0;
    let failed = 0;
    const queue = [...valid];
    const worker = async () => {
      while (queue.length > 0) {
        const { file, folderName } = queue.shift()!;
        try {
          await uploadApi.uploadDocument(file, folderName || undefined);
          success += 1;
        } catch (error) {
          console.error(`上传失败: ${folderName}/${file.name}`, error);
          failed += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(FOLDER_UPLOAD_CONCURRENCY, valid.length) }, () => worker()));
    uploadingFolder.value = false;
    loadDocuments();
    ElMessage.success(`文件夹上传完成：成功 ${success} 个，跳过 ${skipped} 个，失败 ${failed} 个`);
  };

  /** 回退方案（webkitdirectory）：webkitRelativePath 缺失时 folderName 为空（按单文件上传） */
  const handleFolderChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // 清空 value，允许下次重复选择同一文件夹
    await uploadFolderFiles(
      files.map((file) => ({
        file,
        folderName: extractFolderName(file.webkitRelativePath || ''),
      })),
    );
  };

  // ---- 预览 / 来源定位 ----

  /** 释放当前预览的 objectURL（避免内存泄漏） */
  const clearPreviewUrl = () => {
    if (previewState.value?.url) {
      URL.revokeObjectURL(previewState.value.url);
      previewState.value.url = null;
    }
  };

  /** 关闭预览：清空状态并回到聊天视图 */
  const closePreview = () => {
    releasePreview();
    const uiStore = useUiStore();
    if (uiStore.mainView === 'preview') {
      uiStore.setMainView('chat');
    }
  };

  /** 释放预览资源（不切换视图）：预览面板卸载/离开预览视图时调用 */
  const releasePreview = () => {
    clearPreviewUrl();
    previewState.value = null;
    previewLoading.value = false;
  };

  /** 取工作簿第一个工作表并转成带样式的 HTML 表格（SheetJS 输出） */
  const sheetToHtml = (XLSX: typeof import('xlsx'), workbook: WorkBook) => {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return '<div class="xlsx-empty">工作表为空</div>';
    return XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { header: '', footer: '' });
  };

  /**
   * 预览文档：拉取 blob 后在右侧内容区渲染（不再打开新窗口）。
   * 图片/PDF 用 objectURL；docx（mammoth）、xlsx/xls/xlx/csv（SheetJS）、txt/md 转为 HTML；
   * 旧版 .doc 等无法解析的格式保留预览面板并提供下载按钮。
   */
  const previewDocument = async (doc: UploadDocument) => {
    const ext = getExtension(doc.originalName);
    let kind: 'image' | 'pdf' | 'html' | 'unsupported';
    if (IMAGE_EXTENSIONS.has(ext)) kind = 'image';
    else if (ext === '.pdf') kind = 'pdf';
    else if (HTML_EXTENSIONS.has(ext)) kind = 'html';
    else kind = 'unsupported';

    // 清掉上一次预览的 objectURL，避免泄漏
    clearPreviewUrl();
    // 左侧点击文件预览时，同步切换来源高亮
    highlightedDocumentId.value = doc.id;
    previewState.value = { id: doc.id, originalName: doc.originalName, ext, kind, url: null, html: null };
    previewLoading.value = false;
    useUiStore().setMainView('preview');

    // 无法解析的格式：保留预览面板（含下载按钮），无需拉取内容
    if (kind === 'unsupported') return;

    previewLoading.value = true;
    try {
      const blob = await uploadApi.fetchDocumentBlob(doc.id);
      if (kind === 'image' || kind === 'pdf') {
        previewState.value.url = URL.createObjectURL(blob);
      } else if (ext === '.docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        previewState.value.html = result.value;
      } else if (ext === '.xlsx' || ext === '.xls' || ext === '.xlx') {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
        previewState.value.html = sheetToHtml(XLSX, workbook);
      } else if (ext === '.csv') {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(await blob.text(), { type: 'string' });
        previewState.value.html = sheetToHtml(XLSX, workbook);
      } else if (ext === '.md') {
        previewState.value.html = renderMarkdown(await blob.text());
      } else {
        previewState.value.html = escapeHtml(await blob.text());
      }
    } catch (error) {
      console.error(error);
      previewState.value.html = null;
      previewState.value.kind = 'unsupported';
      ElMessage.error('预览加载失败，可下载后查看');
    } finally {
      previewLoading.value = false;
    }
  };

  /**
   * 点击来源文件：定位到左侧"文档列表"中的对应文件——
   * 切到文档管理 tab、展开文件所在文件夹、高亮并滚动到该文件（找不到时提示）。
   */
  const openSourceInDocuments = async (source: any) => {
    const uploadFileId = source?.uploadFileId;
    if (!uploadFileId) return;

    let doc = documents.value.find((d) => d.id === uploadFileId);
    if (!doc) {
      // 文档列表可能尚未加载（如刚进页面未切过 tab），先拉取一次
      await loadDocuments();
      doc = documents.value.find((d) => d.id === uploadFileId);
    }
    if (!doc) {
      ElMessage.warning('该文件已不在文档列表中（可能已被删除）');
      return;
    }

    activeTab.value = 'documents';
    // 切换到聊天主视图，并展开左侧「AI 助手」一级菜单（保证文档列表可见）
    const uiStore = useUiStore();
    uiStore.openView('chat', 'ai');
    // 展开文件所在的顶层文件夹（folderName 如 `2026/文档` → 展开 `2026`）
    if (doc.folderName) {
      const folder = doc.folderName.split('/')[0];
      if (!expandedFolders.value.has(folder)) {
        const next = new Set(expandedFolders.value);
        next.add(folder);
        expandedFolders.value = next;
      }
    }
    // 高亮并平滑滚动到该文件行
    highlightedDocumentId.value = doc.id;
    setTimeout(() => {
      document.getElementById(`doc-item-${doc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  /** 取消文档列表来源高亮（切换到其它菜单/会话时调用） */
  const clearHighlight = () => {
    highlightedDocumentId.value = null;
  };

  return {
    // 状态
    activeTab,
    loadingDocuments,
    documents,
    conversations,
    currentConversation,
    messages,
    expandedFolders,
    highlightedDocumentId,
    deleteDialogVisible,
    deleteDialogContent,
    renameDialogVisible,
    renameDialogTitle,
    renameDialogValue,
    uploadingFolder,
    // 文档预览
    previewState,
    previewLoading,
    // 工具
    formatDate,
    // 数据加载
    loadDocuments,
    loadConversations,
    loadMessages,
    createNewConversation,
    selectConversation,
    // 删除
    openDeleteDialog,
    confirmDeleteDocument,
    deleteBulkDocuments,
    confirmDeleteConversation,
    deleteConversation,
    confirmDeleteAllConversations,
    confirmDelete,
    // 重命名
    openRenameDocumentDialog,
    openRenameConversationDialog,
    confirmRename,
    // 上传
    beforeUpload,
    handleUpload,
    pickFolderWithPicker,
    uploadFolderFiles,
    handleFolderChange,
    // 预览/定位
    previewDocument,
    closePreview,
    releasePreview,
    clearHighlight,
    openSourceInDocuments,
  };
});
