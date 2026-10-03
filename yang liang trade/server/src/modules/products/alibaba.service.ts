import { Injectable, Logger } from '@nestjs/common'
import { ProxyAgent } from 'undici'

export interface AlibabaPreviewItem {
  srcId: number
  name: string
  nameEn: string
  image: string
  images: string[]
  price: string
  moq: string
  certs: string[]
  subCategory?: string
  category?: string
  categoryLabel?: string
  hasLogo?: boolean
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

// 抓取 Alibaba 国际站店铺产品页并解析产品列表（无需登录/API Key）
// 产品数据内嵌于页面 HTML 的 icbu-pc-productListPc 模块 module-data（URL 编码 JSON）
@Injectable()
export class AlibabaService {
  private readonly logger = new Logger(AlibabaService.name)
  private proxyFetch: typeof fetch | null = null

  private getFetch(): typeof fetch {
    if (this.proxyFetch) return this.proxyFetch
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    const make = (dispatcher?: any): typeof fetch =>
      ((input: any, init: any) =>
        fetch(input, { ...init, dispatcher, headers: { 'User-Agent': UA, ...(init?.headers || {}) } })) as typeof fetch
    if (proxyUrl) {
      this.logger.log(`Alibaba 抓取将通过代理: ${proxyUrl}`)
      this.proxyFetch = make(new ProxyAgent(proxyUrl))
    } else {
      this.proxyFetch = make()
    }
    return this.proxyFetch
  }

  // 从店铺产品页/收藏集页抓取产品，自动识别分页模板从第 1 页开始凑满 limit 条
  async scrapeProducts(url: string, limit: number): Promise<AlibabaPreviewItem[]> {
    const gf = this.getFetch()
    const u = new URL(url)
    const host = u.origin
    const firstHtml = await this.fetchText(gf, url)
    const first = this.parsePage(firstHtml)
    const nav = first.nav
    const out: AlibabaPreviewItem[] = []
    const seen = new Set<number>()
    const pageLines = nav?.pageLines || 16
    const totalPages = nav?.totalLines ? Math.ceil(nav.totalLines / pageLines) : 1
    const maxPages = Math.min(totalPages, 50)
    for (let page = 1; page <= maxPages && out.length < limit; page++) {
      let html = firstHtml
      if (page > 1) {
        if (!nav?.formatString) break
        const pageUrl = host + nav.formatString.replace('{0}', String(page))
        try {
          html = await this.fetchText(gf, pageUrl)
        } catch (e) {
          this.logger.warn(`[Alibaba] 第 ${page} 页抓取失败，停止翻页: ${(e as Error).message}`)
          break
        }
      }
      const parsed = this.parsePage(html)
      for (const p of parsed.products || []) {
        if (out.length >= limit) break
        if (!p.subject || seen.has(p.id)) continue
        seen.add(p.id)
        out.push(this.toItem(p))
      }
    }
    return out
  }

  private toItem(p: any): AlibabaPreviewItem {
    const images = (p.imageUrlList || [])
      .map((o: any) => (o.original ? 'https:' + o.original : ''))
      .filter(Boolean)
    const certs = (p.productCertificateLogos || [])
      .map((c: any) => c.name)
      .filter(Boolean)
    return {
      srcId: p.id,
      name: p.subject,
      nameEn: p.subject,
      image: images[0] || '',
      images,
      price: p.fobPriceWithoutUnit || '',
      moq: p.moq || '',
      certs
    }
  }

  private parsePage(html: string): { products: any[]; nav: any } {
    const re = /module-name="icbu-pc-productListPc"[\s\S]*?module-data='([^']*)'/
    const m = html.match(re)
    if (!m) return { products: [], nav: null }
    try {
      const data = JSON.parse(decodeURIComponent(m[1]))
      const md = data?.mds?.moduleData?.data
      return { products: md?.productList || [], nav: md?.pageNavView || null }
    } catch (e) {
      this.logger.warn(`[Alibaba] 解析 module-data 失败: ${(e as Error).message}`)
      return { products: [], nav: null }
    }
  }

  private async fetchText(gf: typeof fetch, u: string): Promise<string> {
    const r = await gf(u)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.text()
  }

  // 按产品名称自动识别细类（限当前大类内匹配，避免跨类误判）
  inferSubCategory(category: string, name: string): string {
    const rules = SUB_CATEGORY_RULES[category]
    if (!rules) return ''
    const text = (name || '').toLowerCase()
    for (const r of rules) {
      if (r.keywords.some((k) => text.includes(k.toLowerCase()))) return r.label
    }
    return ''
  }

  // 按产品名称自动识别所属大类（遍历各细类关键词，命中即归入该大类；未命中走兜底分类）
  inferCategory(name: string): { key: string; label: string } {
    const text = (name || '').toLowerCase()
    for (const [key, rules] of Object.entries(SUB_CATEGORY_RULES)) {
      if (rules.some((r) => r.keywords.some((k) => text.includes(k.toLowerCase())))) {
        return { key, label: CATEGORY_LABELS[key] || key }
      }
    }
    return DEFAULT_CATEGORY
  }
}

// 各产品大类下的细类关键词规则（命中第一个即作为细类）
const SUB_CATEGORY_RULES: Record<string, { keywords: string[]; label: string }[]> = {
  ppe: [
    { keywords: ['口罩', 'mask', 'n95', 'kn95', 'ffp2', 'ffp3', 'face cover'], label: '口罩' },
    { keywords: ['手套', 'glove'], label: '手套' },
    { keywords: ['防护服', '隔离衣', 'protective suit', 'coverall', 'gown', 'isolation'], label: '防护服' },
    { keywords: ['护目镜', '眼罩', 'goggle', 'eye shield'], label: '护目镜' },
    { keywords: ['面罩', 'face shield', 'faceshield'], label: '面罩' },
    { keywords: ['鞋套', '帽', 'cap', 'boot cover', 'shoe cover'], label: '鞋套帽' }
  ],
  monitoring: [
    { keywords: ['血压计', 'sphygmomanometer', 'blood pressure', 'bp monitor', 'bp meter'], label: '血压计' },
    { keywords: ['血糖仪', 'glucose', 'blood sugar', 'diabetes', 'glyc'], label: '血糖仪' },
    { keywords: ['体温计', 'thermometer', 'temperature'], label: '体温计' },
    { keywords: ['血氧仪', 'oximeter', 'oxygen saturation', 'spo2'], label: '血氧仪' },
    { keywords: ['听诊器', 'stethoscope'], label: '听诊器' },
    { keywords: ['监护仪', 'patient monitor', 'vital sign', 'multi-param', 'multiparam'], label: '监护仪' },
    { keywords: ['胎心', 'fetal', 'doppler'], label: '胎心仪' },
    { keywords: ['心电图', 'ecg', 'ekg', 'cardio', 'heart rate'], label: '心电图机' },
    { keywords: ['超声', 'ultrasound'], label: '超声设备' }
  ],
  consumables: [
    { keywords: ['注射器', 'syringe'], label: '注射器' },
    { keywords: ['输液器', 'infusion', 'iv set', 'iv drip', 'iv cannula'], label: '输液器' },
    { keywords: ['导管', 'catheter'], label: '导管' },
    { keywords: ['纱布', 'gauze', 'dressing'], label: '纱布敷料' },
    { keywords: ['绷带', 'bandage'], label: '绷带' },
    { keywords: ['棉签', 'swab', 'cotton'], label: '棉签' },
    { keywords: ['缝合', 'suture'], label: '缝合针线' },
    { keywords: ['采血', 'vacutainer', 'blood collection', 'blood tube'], label: '采血管' },
    { keywords: ['引流', 'drainage', 'drain'], label: '引流袋' },
    { keywords: ['针', 'needle'], label: '注射穿刺针' }
  ],
  rehab: [
    { keywords: ['轮椅', 'wheelchair'], label: '轮椅' },
    { keywords: ['助行', 'walker', 'rollator'], label: '助行器' },
    { keywords: ['拐杖', 'crutch', 'cane'], label: '拐杖' },
    { keywords: ['护理床', 'hospital bed', 'patient bed', 'medical bed'], label: '护理床' },
    { keywords: ['雾化', 'nebulizer', 'nebulisation', 'nebulization'], label: '雾化器' },
    { keywords: ['制氧', 'oxygen concentrator', 'oxygen generator'], label: '制氧机' },
    { keywords: ['按摩', 'massage', 'massager', '筋膜', 'fascia', 'percussion', 'therapy gun'], label: '按摩理疗' },
    { keywords: ['牵引', 'traction'], label: '牵引器' },
    { keywords: ['康复', 'rehab', 'physiotherap', 'exercise'], label: '康复训练' },
    { keywords: ['便盆', 'bedpan', '尿壶', 'urinal', 'commode'], label: '护理用品' }
  ],
  disinfection: [
    { keywords: ['消毒', 'disinfect'], label: '消毒液' },
    { keywords: ['紫外', 'uv', 'ultraviolet'], label: '紫外线消毒' },
    { keywords: ['灭菌', 'steriliz', 'sterilis', 'autoclave'], label: '灭菌器' },
    { keywords: ['净化', 'purifier', 'air purif', 'hepa'], label: '空气净化' },
    { keywords: ['臭氧', 'ozone'], label: '臭氧消毒' },
    { keywords: ['洗手液', 'hand sanitiz', 'sanitizer', 'hand wash'], label: '洗手消毒' }
  ]
}

// 产品大类 key → 中文名（与前端 web/src/data/categories.js 保持一致）
export const CATEGORY_LABELS: Record<string, string> = {
  ppe: '防护用品',
  monitoring: '监测设备',
  consumables: '耗材器械',
  rehab: '护理康复',
  disinfection: '消毒净化'
}

// 无法自动识别时的兜底分类
export const DEFAULT_CATEGORY = { key: 'ppe', label: '防护用品' }

