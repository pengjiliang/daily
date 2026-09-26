<template>
  <div class="login-page">
    <div class="card">
      <div class="logo"><el-icon :size="34"><FirstAidKit /></el-icon></div>
      <h2>扬良贸易 · 管理后台</h2>
      <p class="sub">首次使用请注册管理员账号</p>
      <el-tabs v-model="tab" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-position="top" @keyup.enter="doLogin">
            <el-form-item label="账号"><el-input v-model="loginForm.username" placeholder="请输入账号" /></el-form-item>
            <el-form-item label="密码"><el-input v-model="loginForm.password" type="password" show-password placeholder="请输入密码" /></el-form-item>
            <el-button type="primary" :loading="loading" style="width: 100%" @click="doLogin">登 录</el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form :model="regForm" label-position="top" @keyup.enter="doRegister">
            <el-form-item label="账号"><el-input v-model="regForm.username" placeholder="设置管理员账号" /></el-form-item>
            <el-form-item label="密码"><el-input v-model="regForm.password" type="password" show-password placeholder="设置登录密码" /></el-form-item>
            <el-form-item label="确认密码"><el-input v-model="regForm.confirm" type="password" show-password placeholder="再次输入密码" /></el-form-item>
            <el-button type="primary" :loading="loading" style="width: 100%" @click="doRegister">注册并登录</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FirstAidKit } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const tab = ref('login')
const loading = ref(false)
const loginForm = ref({ username: '', password: '' })
const regForm = ref({ username: '', password: '', confirm: '' })

async function call(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '请求失败')
  return data
}

function enter(username, token) {
  localStorage.setItem('yl_admin_token', token)
  localStorage.setItem('yl_admin_user', username)
  ElMessage.success('登录成功')
  router.push(route.query.redirect || '/admin/dashboard')
}

async function doLogin() {
  const { username, password } = loginForm.value
  if (!username || !password) return ElMessage.warning('请填写账号与密码')
  loading.value = true
  try { const d = await call('auth/login', { username, password }); enter(d.username, d.token) }
  catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function doRegister() {
  const { username, password, confirm } = regForm.value
  if (!username || !password) return ElMessage.warning('请填写账号与密码')
  if (password !== confirm) return ElMessage.warning('两次密码不一致')
  loading.value = true
  try { const d = await call('auth/register', { username, password }); enter(d.username, d.token) }
  catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
</script>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(120deg, #f0f6ff, #f5f7fa); padding: 24px; }
.card { width: 400px; background: #fff; border-radius: 10px; padding: 40px 36px; box-shadow: 0 12px 40px rgba(0,0,0,.08); text-align: center; }
.logo { width: 60px; height: 60px; margin: 0 auto 12px; border-radius: 16px; background: linear-gradient(135deg, var(--yl-primary-light), var(--yl-cyan)); color: #fff; display: flex; align-items: center; justify-content: center; }
h2 { margin: 0 0 4px; font-size: 22px; }
.sub { color: var(--yl-text-light); font-size: 13px; margin: 0 0 20px; }
</style>
