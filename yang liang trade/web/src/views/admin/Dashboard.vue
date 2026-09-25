<template>
  <div>
    <h2 class="page-title">仪表盘</h2>
    <div class="stats">
      <div class="stat-card"><div class="num">{{ stats.products }}</div><div class="label">产品总数</div></div>
      <div class="stat-card"><div class="num">{{ stats.leads }}</div><div class="label">已抓取线索</div></div>
      <div class="stat-card"><div class="num">{{ stats.campaigns }}</div><div class="label">群发任务</div></div>
      <div class="stat-card"><div class="num">{{ stats.messages }}</div><div class="label">已发送消息</div></div>
    </div>

    <el-card shadow="never" style="margin-top: 24px">
      <template #header>最近抓取线索</template>
      <el-table :data="recentLeads" size="default">
        <el-table-column prop="name" label="店铺名称" />
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column prop="phone" label="电话" width="140" />
        <el-table-column prop="city" label="地区" width="110" />
        <el-table-column prop="hasWhatsApp" label="WhatsApp" width="100">
          <template #default="{ row }">
            <el-tag :type="row.hasWhatsApp ? 'success' : 'info'" size="small">{{ row.hasWhatsApp ? '已识别' : '未知' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const leads = JSON.parse(localStorage.getItem('yl_leads') || '[]')
const campaigns = JSON.parse(localStorage.getItem('yl_campaigns') || '[]')

const stats = computed(() => ({
  products: 10,
  leads: leads.length,
  campaigns: campaigns.length,
  messages: campaigns.reduce((s, c) => s + (c.sent || 0), 0)
}))
const recentLeads = computed(() => leads.slice(-6).reverse())
</script>

<style scoped>
.page-title { margin: 0 0 20px; font-size: 24px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.stat-card { background: #fff; border-radius: var(--yl-radius); border: 1px solid #eef2f7; padding: 24px; }
.stat-card .num { font-size: 30px; font-weight: 800; color: var(--yl-primary); }
.stat-card .label { color: var(--yl-text-light); margin-top: 6px; font-size: 14px; }
</style>
