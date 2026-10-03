<template>
  <div ref="el" class="trend-chart" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { t } from '@/i18n'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  items: { type: Array, default: () => [] }
})
const emit = defineEmits(['select'])

const el = ref(null)
let chart = null
let selected = {}

function monthLabels(n) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return t('atc_month_n', { n: d.getMonth() + 1 })
  })
}

// 默认全部关键词都显示在趋势图上，可通过图例点选隐藏
function defaultSelected() {
  const sel = {}
  for (const i of props.items) sel[i.label] = true
  return sel
}

// 根据当前可见关键词的数据范围动态缩放 Y 轴，放大趋势波动
function yAxisRange() {
  const visible = props.items.filter((i) => selected[i.label] !== false)
  const all = visible.length ? visible.flatMap((i) => i.series) : [0, 100]
  const dataMin = Math.min(...all)
  const dataMax = Math.max(...all)
  const pad = Math.max(5, (dataMax - dataMin) * 0.2)
  let min = Math.max(0, Math.floor((dataMin - pad) / 5) * 5)
  let max = Math.min(100, Math.ceil((dataMax + pad) / 5) * 5)
  if (max - min < 15) {
    const mid = (max + min) / 2
    min = Math.max(0, Math.round(mid - 7.5))
    max = Math.min(100, Math.round(mid + 7.5))
  }
  return { min, max }
}

// 每条线 hover 时显示具体产品名称
function tooltipFormatter(params) {
  const item = props.items.find((i) => i.label === params.seriesName)
  if (!item) return `${params.seriesName}<br/>${t('atc_heat', { v: params.value })}`
  const products = item.products.length ? item.products.join('、') : t('atc_none')
  return `${item.label}（${item.keyword}）<br/>${t('atc_heat', { v: params.value })}<br/>${t('atc_covered_products', { list: products })}`
}

function render() {
  if (!el.value) return
  if (!chart) {
    chart = echarts.init(el.value)
    chart.on('click', (params) => {
      if (params.seriesName) emit('select', params.seriesName)
    })
    chart.on('legendselectchanged', (params) => {
      selected = params.selected
      render()
    })
    window.addEventListener('resize', onResize)
  }
  const labels = monthLabels(Math.max(...props.items.map((i) => i.series.length), 1))
  const { min, max } = yAxisRange()
  chart.setOption({
    color: ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#8e44ad', '#16a085', '#e74c3c', '#2980b9', '#d35400', '#27ae60', '#2c3e50'],
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(48,65,86,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: tooltipFormatter
    },
    legend: { type: 'scroll', bottom: 0, selected, itemWidth: 14, itemHeight: 10, textStyle: { fontSize: 12 } },
    grid: { left: 44, right: 24, top: 30, bottom: 56 },
    xAxis: { type: 'category', boundaryGap: false, data: labels, axisLine: { lineStyle: { color: '#dcdfe6' } }, axisLabel: { color: '#909399' } },
    yAxis: {
      type: 'value',
      min,
      max,
      splitNumber: 12,
      axisLabel: { color: '#909399' },
      splitLine: { lineStyle: { color: '#f0f2f5' } }
    },
    series: props.items.map((item) => ({
      name: item.label,
      type: 'line',
      data: item.series,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' }
    }))
  })
}

function onResize() {
  chart && chart.resize()
}

watch(() => props.items, () => {
  selected = defaultSelected()
  render()
}, { deep: true })

onMounted(() => {
  selected = defaultSelected()
  render()
})
onBeforeUnmount(() => {
  if (chart) {
    window.removeEventListener('resize', onResize)
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
.trend-chart { width: 100%; height: 440px; }
</style>
