// 深浅主题：手动切换，localStorage 持久化；前台/后台同源共享，天然联动
import { ref } from 'vue'

const KEY = 'yl_theme'

function initial() {
  const saved = localStorage.getItem(KEY)
  return saved === 'dark' || saved === 'light' ? saved : 'light'
}

export const theme = ref(initial())

export function applyTheme(mode = theme.value) {
  theme.value = mode
  document.documentElement.classList.toggle('dark', mode === 'dark')
  localStorage.setItem(KEY, mode)
}

export function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

applyTheme()
