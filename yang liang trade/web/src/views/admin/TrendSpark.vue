<template>
  <div ref="el" class="spark" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { t } from '@/i18n'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  series: { type: Array, default: () => [] },
  color: { type: String, default: '#409eff' }
})

const el = ref(null)
let chart = null

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  const now = new Date()
  const labels = props.series.map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (props.series.length - 1 - i), 1)
    return t('atc_month_n', { n: d.getMonth() + 1 })
  })
  chart.setOption({
    grid: { left: 2, right: 2, top: 4, bottom: 2 },
    xAxis: { type: 'category', show: false, data: labels, boundaryGap: false },
    yAxis: { type: 'value', show: false, min: 0, max: 100 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: 'rgba(48,65,86,.9)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (ps) => `${ps[0].axisValue}：${ps[0].data}`
    },
    series: [{
      type: 'line',
      data: props.series,
      smooth: true,
      showSymbol: false,
      symbolSize: 3,
      lineStyle: { width: 2, color: props.color },
      itemStyle: { color: props.color },
      areaStyle: { color: props.color, opacity: 0.08 }
    }]
  })
}

onMounted(render)
watch(() => props.series, render, { deep: true })
watch(() => props.color, render)
onBeforeUnmount(() => {
  if (chart) { chart.dispose(); chart = null }
})
</script>

<style scoped>
.spark { width: 140px; height: 44px; }
</style>
