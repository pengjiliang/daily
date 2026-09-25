<template>
  <div class="page-section">
    <div class="container">
      <h2 class="section-title">联系我们</h2>
      <p class="section-sub">期待与您合作，随时欢迎咨询与洽谈</p>

      <div class="grid">
        <!-- WhatsApp 主入口 -->
        <div class="whatsapp-card">
          <div class="wa-head">
            <div class="wa-icon">
              <el-icon :size="40"><PhoneFilled /></el-icon>
            </div>
            <div>
              <h3>WhatsApp 即时咨询</h3>
              <p>点击按钮直接发起对话，快速获取报价与样品</p>
            </div>
          </div>
          <a class="wa-btn" :href="waLink" target="_blank" rel="noopener">
            <el-icon><ChatDotRound /></el-icon> 通过 WhatsApp 联系我
          </a>
          <div class="wa-note">号码：{{ waNumber }}（点击直达对话）</div>
        </div>

        <!-- 联系方式 -->
        <div class="info-card">
          <div class="info-row">
            <el-icon><Location /></el-icon><span>地址：中国 · 湖南 · 长沙 · 宁乡</span>
          </div>
          <div class="info-row">
            <el-icon><Phone /></el-icon><span>电话：+86 138 7499 0232</span>
          </div>
          <div class="info-row">
            <el-icon><Message /></el-icon><span>邮箱：sales@yangliang-trade.com</span>
          </div>
          <div class="info-row">
            <el-icon><Clock /></el-icon><span>工作时间：周一至周六 9:00 - 18:00</span>
          </div>
        </div>
      </div>

      <!-- 留言 -->
      <div class="form-card">
        <h3>在线留言</h3>
        <el-form :model="form" label-position="top" class="form">
          <div class="form-grid">
            <el-form-item label="姓名 / 公司"><el-input v-model="form.name" placeholder="请输入" /></el-form-item>
            <el-form-item label="WhatsApp / 电话"
              ><el-input v-model="form.phone" placeholder="便于我们与您联系"
            /></el-form-item>
          </div>
          <el-form-item label="留言内容"
            ><el-input
              v-model="form.message"
              type="textarea"
              :rows="4"
              placeholder="请输入您的需求，如产品、数量、目标市场等"
          /></el-form-item>
          <el-button type="primary" size="large" round @click="submit">提交留言</el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ChatDotRound, PhoneFilled, Location, Phone, Message, Clock } from '@element-plus/icons-vue';

// 老板/公司 WhatsApp 号码（后续可从后端 contact_info 接口读取配置）
const waNumber = '8613874990232';
const route = useRoute();
const form = reactive({ name: '', phone: '', message: route.query.subject ? `咨询产品：${route.query.subject}` : '' });

const waLink = computed(() => {
  const text = encodeURIComponent(`您好，我是${form.name || '客户'}。${form.message || '我想咨询贵公司产品。'}`);
  return `https://wa.me/${waNumber}?text=${text}`;
});

function submit() {
  if (!form.message) return ElMessage.warning('请填写留言内容');
  // 当前为演示；后续提交到后端 /api/contact/messages
  ElMessage.success('留言已提交，我们将尽快与您联系！');
  form.name = '';
  form.phone = '';
  form.message = '';
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 24px;
  margin-bottom: 40px;
}
.whatsapp-card,
.info-card,
.form-card {
  background: #fff;
  border-radius: var(--yl-radius);
  border: 1px solid #eef2f7;
}
.whatsapp-card {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: #fff;
  padding: 32px;
}
.wa-head {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
}
.wa-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}
.wa-head h3 {
  margin: 0 0 6px;
}
.wa-head p {
  margin: 0;
  opacity: 0.88;
  font-size: 14px;
}
.wa-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #25d366;
  color: #fff;
  font-weight: 700;
  padding: 14px 28px;
  border-radius: 30px;
  font-size: 16px;
}
.wa-btn:hover {
  background: #1ebe5b;
}
.wa-note {
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.85;
}
.info-card {
  padding: 32px;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dashed #eef2f7;
  font-size: 15px;
}
.info-row:last-child {
  border-bottom: none;
}
.info-row .el-icon {
  color: var(--yl-primary);
  font-size: 20px;
}
.form-card {
  padding: 32px;
}
.form-card h3 {
  margin: 0 0 20px;
  font-size: 20px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
