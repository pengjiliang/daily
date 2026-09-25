// 产品展示数据（当前为演示数据，后续可由后端 /api/products 提供）
export const categories = [
  { key: 'all', label: '全部' },
  { key: 'ppe', label: '防护用品' },
  { key: 'monitoring', label: '监测设备' },
  { key: 'consumables', label: '耗材器械' },
  { key: 'rehab', label: '护理康复' },
  { key: 'disinfection', label: '消毒净化' }
]

export const products = [
  {
    id: 1, name: '医用外科口罩', nameEn: 'Surgical Face Mask',
    category: 'ppe', image: '/images/product-mask.svg',
    spec: '三层防护 · 细菌过滤率 ≥ 95%',
    desc: '一次性医用外科口罩，三层无纺布结构，透气亲肤，适用于医疗防护与日常防护场景，通过 CE / FDA 认证。',
    features: ['三层过滤结构', '舒适耳挂设计', '独立无菌包装', '出口认证齐全']
  },
  {
    id: 2, name: '一次性医用手套', nameEn: 'Nitrile Exam Gloves',
    category: 'ppe', image: '/images/product-gloves.svg',
    spec: '丁腈材质 · 无粉 · 加厚',
    desc: '丁腈检查手套，无粉配方，防油耐化学，佩戴贴合不刺激，广泛用于医疗检查、实验室与工业防护。',
    features: ['食品级安全材质', '高弹性贴合', '纹理防滑', '可降解环保']
  },
  {
    id: 3, name: '电子血压计', nameEn: 'Digital Blood Pressure Monitor',
    category: 'monitoring', image: '/images/product-bp-monitor.svg',
    spec: '上臂式 · 智能加压 · 语音播报',
    desc: '上臂式电子血压计，智能加压技术测量精准，大屏显示并支持语音播报与记忆存储，家用与诊所通用。',
    features: ['医用级精准', '大屏背光', '双人记忆 99 组', '血压分级提示']
  },
  {
    id: 4, name: '红外额温枪', nameEn: 'Infrared Thermometer',
    category: 'monitoring', image: '/images/product-thermometer.svg',
    spec: '非接触 · 1 秒测温 · 高精度',
    desc: '红外非接触式体温计，一秒快速测温，高精度传感器，支持 ℃/℉ 切换，适用于家庭、医院与公共出入口。',
    features: ['非接触更安全', '三色背光提示', '静音模式', '自动关机省电']
  },
  {
    id: 5, name: '一次性无菌注射器', nameEn: 'Disposable Syringe',
    category: 'consumables', image: '/images/product-syringe.svg',
    spec: '1ml–50ml 多种规格 · 无菌',
    desc: '一次性使用无菌注射器，医用级材料，刻度清晰，活塞顺滑，环氧乙烷灭菌，规格齐全支持定制。',
    features: ['独立无菌包装', '刻度清晰', '针筒针头分离', '规格齐全']
  },
  {
    id: 6, name: '医用输液器', nameEn: 'IV Infusion Set',
    category: 'consumables', image: '/images/product-infusion.svg',
    spec: '精密滴管 · 防回流',
    desc: '一次性精密输液器，滴速稳定可调，防回血设计，配合输液泵使用效果更佳，无菌生产保障用药安全。',
    features: ['精密调节滴速', '防回血阀', '无 DEHP 材质', '无菌安全']
  },
  {
    id: 7, name: '手术器械包', nameEn: 'Surgical Instrument Kit',
    category: 'consumables', image: '/images/product-surgical.svg',
    spec: '不锈钢 · 消毒可重复使用',
    desc: '外科手术器械套装，医用不锈钢材质，做工精细，覆盖基础外科手术常用器械，支持 OEM 定制。',
    features: ['医用 304 不锈钢', '耐高温消毒', '多种套件可选', '支持 OEM']
  },
  {
    id: 8, name: '医用敷料贴', nameEn: 'Medical Dressing',
    category: 'rehab', image: '/images/product-dressing.svg',
    spec: '透气无纺布 · 低致敏',
    desc: '医用无菌敷料贴，柔软透气不粘伤口，低致敏胶体，适合术后伤口与日常创面护理，规格齐全。',
    features: ['透气舒适', '低敏黏胶', '独立无菌包装', '规格齐全']
  },
  {
    id: 9, name: '电动轮椅', nameEn: 'Electric Wheelchair',
    category: 'rehab', image: '/images/product-wheelchair.svg',
    spec: '锂电池 · 可折叠 · 遥控',
    desc: '轻便可折叠电动轮椅，锂电池续航持久，前后双刹车安全可靠，适用于老年人及行动不便人士出行。',
    features: ['轻量可折叠', '锂电池长续航', '电磁双刹车', '可调速遥控']
  },
  {
    id: 10, name: '医用消毒设备', nameEn: 'Medical Disinfection Device',
    category: 'disinfection', image: '/images/product-disinfector.svg',
    spec: '臭氧+紫外线 · 大空间',
    desc: '医用级空气消毒净化设备，臭氧与紫外线双重消毒，适用于诊室、病房、学校等公共空间消毒杀菌。',
    features: ['双重消毒模式', '定时智能控制', '低噪音运行', '大空间适用']
  }
]

export function getProduct(id) {
  return products.find((p) => String(p.id) === String(id))
}
