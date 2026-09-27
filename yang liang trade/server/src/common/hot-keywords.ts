// 谷歌热卖医疗器械关键词库（英文词用于匹配产品与趋势，中文为展示标签）
export interface HotKeyword {
  keyword: string
  label: string
  category: string
}

export const HOT_KEYWORDS: HotKeyword[] = [
  { keyword: 'blood pressure monitor', label: '血压计', category: 'monitoring' },
  { keyword: 'glucose meter', label: '血糖仪', category: 'monitoring' },
  { keyword: 'pulse oximeter', label: '血氧仪', category: 'monitoring' },
  { keyword: 'infrared thermometer', label: '红外体温计', category: 'monitoring' },
  { keyword: 'ecg machine', label: '心电图机', category: 'monitoring' },
  { keyword: 'fetal doppler', label: '胎心仪', category: 'monitoring' },
  { keyword: 'wheelchair', label: '轮椅', category: 'rehab' },
  { keyword: 'walker', label: '助行器', category: 'rehab' },
  { keyword: 'hospital bed', label: '护理床', category: 'rehab' },
  { keyword: 'oxygen concentrator', label: '制氧机', category: 'rehab' },
  { keyword: 'nebulizer', label: '雾化器', category: 'rehab' },
  { keyword: 'surgical mask', label: '医用口罩', category: 'ppe' },
  { keyword: 'n95 mask', label: 'N95 口罩', category: 'ppe' },
  { keyword: 'nitrile gloves', label: '丁腈手套', category: 'ppe' },
  { keyword: 'protective coverall', label: '防护服', category: 'ppe' },
  { keyword: 'face shield', label: '防护面罩', category: 'ppe' },
  { keyword: 'disposable syringe', label: '一次性注射器', category: 'consumables' },
  { keyword: 'infusion set', label: '输液器', category: 'consumables' },
  { keyword: 'urinary catheter', label: '导尿管', category: 'consumables' },
  { keyword: 'medical gauze', label: '医用纱布', category: 'consumables' },
  { keyword: 'cotton swab', label: '医用棉签', category: 'consumables' },
  { keyword: 'suture', label: '手术缝合线', category: 'consumables' },
  { keyword: 'disinfectant', label: '医用消毒液', category: 'disinfection' },
  { keyword: 'uv sterilizer', label: '紫外线消毒器', category: 'disinfection' }
]

// 判断产品命中了哪些热卖关键词（铺货覆盖判断）
export function matchHotKeywords(p: {
  name?: string
  nameEn?: string
  spec?: string
  categoryLabel?: string
  subCategory?: string
}): string[] {
  const text = [p.name, p.nameEn, p.spec, p.categoryLabel, p.subCategory].join(' ').toLowerCase()
  return HOT_KEYWORDS.filter((k) => text.includes(k.keyword.toLowerCase())).map((k) => k.keyword)
}
