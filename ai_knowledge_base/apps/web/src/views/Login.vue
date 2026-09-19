<!--
  登录页：用户名/密码表单（Element Plus 校验），登录成功后把 JWT 与用户信息
  写入 Pinia（并持久化到 localStorage），随后跳转主页。
-->
<template>
  <div class="login-container">
    <el-card class="login-card">
      <h2 class="title">用户登录</h2>
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="80px" class="login-form">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="formData.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin" style="width: 100%"> 登录 </el-button>
        </el-form-item>
        <el-form-item>
          <div class="footer">还没有账号？<router-link to="/register">立即注册</router-link></div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// 登录页逻辑：表单校验 → 调登录接口 → 保存登录态 → 跳转主页
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { useUserStore } from '../stores/user';
import request from '../api/request';
import { authApi } from '../api/auth';

const formRef = ref<FormInstance>();
const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);

const formData = ref({
  username: '',
  password: '',
});

const rules = ref<FormRules>({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      min: 3,
      max: 20,
      message: '用户名长度在 3 到 20 个字符',
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 个字符', trigger: 'blur' },
  ],
});

/** 提交登录：先做前端表单校验，通过后请求接口并保存 token/用户信息 */
async function handleLogin() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        const res: any = await authApi.login(formData.value);
        userStore.setToken(res.access_token);
        userStore.setUserInfo({
          id: res.user.id,
          username: res.user.username,
          avatarUrl: res.user.avatarUrl,
        });
        ElMessage.success('登录成功');
        router.push('/home');
      } catch (error) {
        console.error(error);
      } finally {
        loading.value = false;
      }
    }
  });
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--kb-bg-page);
}

.login-card {
  width: 400px;
}

.title {
  text-align: center;
  margin-bottom: 20px;
}

.login-form {
  margin-top: 20px;
}

.footer {
  text-align: center;
  width: 100%;
}

.footer a {
  color: var(--el-color-primary);
  text-decoration: none;
}
</style>
