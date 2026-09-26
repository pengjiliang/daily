<template>
  <div class="page-section">
    <div class="container">
      <h2 class="section-title">{{ t('contact_title') }}</h2>
      <p class="section-sub">{{ t('contact_sub') }}</p>

      <div class="grid">
        <!-- WhatsApp 主入口 -->
        <div class="whatsapp-card">
          <div class="wa-head">
            <div class="wa-icon">
              <el-icon :size="40"><PhoneFilled /></el-icon>
            </div>
            <div>
              <h3>{{ t('contact_wa_title') }}</h3>
              <p>{{ t('contact_wa_p') }}</p>
            </div>
          </div>
          <a class="wa-btn" :href="waLink" target="_blank" rel="noopener">
            <el-icon><ChatDotRound /></el-icon> {{ t('contact_wa_btn') }}
          </a>
          <div class="wa-note">{{ t('contact_wa_note', { n: waNumber }) }}</div>
        </div>

        <!-- 联系方式 -->
        <div class="info-card">
          <div class="info-row">
            <el-icon><Location /></el-icon><span>{{ t('contact_addr') }}</span>
          </div>
          <div class="info-row">
            <el-icon><Phone /></el-icon><span>{{ t('contact_phone') }}</span>
          </div>
          <div class="info-row">
            <el-icon><Message /></el-icon><span>{{ t('contact_email') }}</span>
          </div>
          <div class="info-row">
            <el-icon><Clock /></el-icon><span>{{ t('contact_hours') }}</span>
          </div>
        </div>
      </div>

      <!-- 留言 -->
      <div class="form-card">
        <h3>{{ t('contact_form_title') }}</h3>
        <el-form :model="form" label-position="top" class="form">
          <div class="form-grid">
            <el-form-item :label="t('contact_name')"><el-input v-model="form.name" :placeholder="t('contact_name_ph')" /></el-form-item>
            <el-form-item :label="t('contact_phone_label')"
              ><el-input v-model="form.phone" :placeholder="t('contact_phone_ph')"
            /></el-form-item>
          </div>
          <el-form-item :label="t('contact_msg_label')"
            ><el-input
              v-model="form.message"
              type="textarea"
              :rows="4"
              :placeholder="t('contact_msg_ph')"
          /></el-form-item>
          <el-button type="primary" size="large" round @click="submit">{{ t('contact_submit') }}</el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ChatDotRound, PhoneFilled, Location, Phone, Message, Clock } from '@element-plus/icons-vue';
import { t } from '@/i18n';

// 老板/公司 WhatsApp 号码（后续可从后端 contact_info 接口读取配置）
const waNumber = '8613874990232';
const route = useRoute();
const form = reactive({ name: '', phone: '', message: route.query.subject ? t('contact_subject', { s: route.query.subject }) : '' });

const waLink = computed(() => {
  const text = encodeURIComponent(t('contact_wa_hello', { c: form.name || t('contact_customer'), m: form.message || t('contact_wa_default') }));
  return `https://wa.me/${waNumber}?text=${text}`;
});

function submit() {
  if (!form.message) return ElMessage.warning(t('contact_msg_required'));
  // 当前为演示；后续提交到后端 /api/contact/messages
  ElMessage.success(t('contact_success'));
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
  background: linear-gradient(135deg, #409eff, #337ecc);
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
