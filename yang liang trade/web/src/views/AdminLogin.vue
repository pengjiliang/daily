<template>
  <div class="login-page">
    <div class="card">
      <div class="lang-bar"><el-button text size="small" @click="toggleLang">{{ isEn ? t('hd_lang_zh') : t('hd_lang_en') }}</el-button></div>
      <div class="logo"><BrandLogo :size="60" /></div>
      <h2>{{ t('alog_title') }}</h2>
      <p class="sub">{{ t(canRegister ? 'alog_sub_register' : 'alog_sub_login') }}</p>
      <el-tabs v-model="tab" stretch>
        <el-tab-pane :label="t('alog_tab_login')" name="login">
          <el-form :model="loginForm" label-position="top" @keyup.enter="doLogin">
            <el-form-item :label="t('alog_username')"><el-input v-model="loginForm.username" :placeholder="t('alog_username_ph')" /></el-form-item>
            <el-form-item :label="t('alog_password')"><el-input v-model="loginForm.password" type="password" show-password :placeholder="t('alog_password_ph')" /></el-form-item>
            <el-button type="primary" :loading="loading" style="width: 100%" @click="doLogin">{{ t('alog_login_btn') }}</el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane v-if="canRegister" :label="t('alog_tab_register')" name="register">
          <el-form :model="regForm" label-position="top" @keyup.enter="doRegister">
            <el-form-item :label="t('alog_username')"><el-input v-model="regForm.username" :placeholder="t('alog_reg_username_ph')" /></el-form-item>
            <el-form-item :label="t('alog_password')"><el-input v-model="regForm.password" type="password" show-password :placeholder="t('alog_reg_password_ph')" /></el-form-item>
            <el-form-item :label="t('alog_confirm_password')"><el-input v-model="regForm.confirm" type="password" show-password :placeholder="t('alog_confirm_ph')" /></el-form-item>
            <el-button type="primary" :loading="loading" style="width: 100%" @click="doRegister">{{ t('alog_register_btn') }}</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BrandLogo from '@/components/BrandLogo.vue'
import { t, isEn, setLang } from '@/i18n'

function toggleLang() { setLang(isEn.value ? 'zh' : 'en') }
const route = useRoute()
const router = useRouter()
const tab = ref('login')
const canRegister = ref(false)
const loading = ref(false)
const loginForm = ref({ username: '', password: '' })
const regForm = ref({ username: '', password: '', confirm: '' })

async function call(path, body, method = 'POST') {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || t('a_request_failed'))
  return data
}

function enter(username, token) {
  localStorage.setItem('yl_admin_token', token)
  localStorage.setItem('yl_admin_user', username)
  ElMessage.success(t('alog_success'))
  router.push(route.query.redirect || '/admin/dashboard')
}

async function doLogin() {
  const { username, password } = loginForm.value
  if (!username || !password) return ElMessage.warning(t('alog_need_credentials'))
  loading.value = true
  try { const d = await call('auth/login', { username, password }); enter(d.username, d.token) }
  catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

onMounted(async () => {
  try {
    const data = await call('auth/setup-status', undefined, 'GET')
    canRegister.value = data.canRegister === true
  } catch {}
})

async function doRegister() {
  const { username, password, confirm } = regForm.value
  if (!username || !password) return ElMessage.warning(t('alog_need_credentials'))
  if (password !== confirm) return ElMessage.warning(t('alog_password_mismatch'))
  loading.value = true
  try { const d = await call('auth/register', { username, password }); enter(d.username, d.token) }
  catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
</script>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(120deg, #f0f6ff, #f5f7fa); padding: 24px; }
.card { width: 400px; background: #fff; border-radius: 10px; padding: 40px 36px; box-shadow: 0 12px 40px rgba(0,0,0,.08); text-align: center; }
.lang-bar { display: flex; justify-content: flex-end; margin-bottom: 2px; }
.logo { width: 60px; height: 60px; margin: 0 auto 12px; border-radius: 16px; background: linear-gradient(135deg, var(--yl-primary-light), var(--yl-cyan)); color: #fff; display: flex; align-items: center; justify-content: center; }
h2 { margin: 0 0 4px; font-size: 22px; }
.sub { color: var(--yl-text-light); font-size: 13px; margin: 0 0 20px; }
</style>
