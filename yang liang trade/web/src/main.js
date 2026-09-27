import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// 全局表格：内容/表头超出省略时，鼠标移上去显示全部内容
document.addEventListener('mouseover', (e) => {
  const target = e.target
  if (!target || !target.closest) return
  const cell = target.closest('.el-table .cell')
  if (!cell) return
  const text = (cell.textContent || '').trim()
  if (cell.scrollWidth > cell.clientWidth + 2) {
    if (cell.getAttribute('title') !== text) cell.setAttribute('title', text)
  } else if (cell.hasAttribute('title')) {
    cell.removeAttribute('title')
  }
})

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
