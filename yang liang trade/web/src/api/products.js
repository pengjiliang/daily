// 产品数据统一从后端 /api/products 拉取（数据已入库 PostgreSQL）
import { ref } from 'vue'

const products = ref([])
let loaded = false

export async function loadProducts() {
  if (loaded) return products.value
  const res = await fetch('/api/products')
  if (res.ok) {
    products.value = await res.json()
    loaded = true
  }
  return products.value
}

export function getProduct(id) {
  return products.value.find((p) => String(p.id) === String(id))
}

export { products }
