<template>
  <div class="chat-root">
    <transition name="el-fade-in">
      <div v-if="open" class="chat-panel">
        <div class="chat-head">
          <div>
            <div class="chat-title">扬良 AI 智能客服</div>
            <div class="chat-sub">基于公司产品资料的智能助手</div>
          </div>
          <el-button text circle style="color:#fff" @click="open = false"><el-icon><Close /></el-icon></el-button>
        </div>
        <div ref="listRef" class="chat-body">
          <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
            <div class="bubble">{{ m.text }}</div>
          </div>
          <div v-if="streaming" class="msg assistant"><div class="bubble">{{ streamText || '正在思考…' }}</div></div>
        </div>
        <div class="chat-input">
          <el-input v-model="input" placeholder="输入您的问题，如：有哪些防护用品？" @keyup.enter="send" />
          <el-button type="primary" :disabled="!input.trim() || streaming" @click="send">发送</el-button>
        </div>
      </div>
    </transition>
    <el-button class="chat-fab" type="primary" circle size="large" @click="open = !open">
      <el-icon v-if="!open"><ChatDotRound /></el-icon>
      <el-icon v-else><Close /></el-icon>
    </el-button>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, Close } from '@element-plus/icons-vue'

const open = ref(false)
const input = ref('')
const streaming = ref(false)
const streamText = ref('')
const listRef = ref(null)
const messages = ref([
  { role: 'assistant', text: '您好，我是扬良贸易 AI 智能客服，可以为您介绍产品、索取报价或解答常见问题。请问有什么可以帮您？' }
])

watch(open, async () => { if (open.value) await scrollBottom() })

async function scrollBottom() {
  await nextTick()
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
}

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  messages.value.push({ role: 'user', text })
  input.value = ''
  streamText.value = ''
  streaming.value = true
  scrollBottom()

  const history = messages.value
    .filter((m) => m.role !== 'assistant' || m.text)
    .slice(0, -1)
    .slice(-8)
    .map((m) => ({ role: m.role, text: m.text }))

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    })
    if (!res.ok) throw new Error('请求失败')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          if (data.error) throw new Error(data.error)
          else if (data.delta) {
            streamText.value += data.delta
            scrollBottom()
          }
        }
      }
    }
    if (streamText.value.trim()) messages.value.push({ role: 'assistant', text: streamText.value })
    else messages.value.push({ role: 'assistant', text: '（未收到回复，请检查模型配置）' })
  } catch (e) {
    ElMessage.error(e?.message || 'AI 服务连接失败')
    messages.value.push({ role: 'assistant', text: `抱歉，AI 服务暂时不可用：${e?.message || ''}` })
  } finally {
    streaming.value = false
    scrollBottom()
  }
}
</script>

<style scoped>
.chat-root { position: fixed; right: 24px; bottom: 24px; z-index: 200; }
.chat-fab { width: 54px; height: 54px; font-size: 24px; box-shadow: 0 8px 24px rgba(37,99,235,.35); }
.chat-panel { position: absolute; right: 0; bottom: 66px; width: 340px; height: 480px; background: #fff; border-radius: 16px; box-shadow: 0 16px 48px rgba(15,23,42,.18); display: flex; flex-direction: column; overflow: hidden; }
.chat-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: linear-gradient(90deg, var(--yl-primary-light), var(--yl-cyan)); color: #fff; }
.chat-title { font-weight: 700; }
.chat-sub { font-size: 12px; opacity: .85; }
.chat-body { flex: 1; overflow-y: auto; padding: 14px; background: #f6f9fc; }
.msg { margin-bottom: 12px; display: flex; }
.msg.user { justify-content: flex-end; }
.bubble { max-width: 82%; padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.msg.assistant .bubble { background: #fff; border: 1px solid #e5eaf1; border-top-left-radius: 4px; }
.msg.user .bubble { background: var(--yl-primary); color: #fff; border-top-right-radius: 4px; }
.chat-input { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eef2f7; background: #fff; }
</style>
