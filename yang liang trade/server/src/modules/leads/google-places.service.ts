import { Injectable, Logger } from '@nestjs/common'
import { ProxyAgent } from 'undici'

export interface ScrapeOptions {
  keyword: string
  regions: string[]   // se / sa / ca / na
  types: string[]
  limit?: number
  mode?: 'demo' | 'google' | 'osm'
}

export interface LeadData {
  name: string
  type: string
  phone: string
  website: string
  region: string
  city: string
  hasWhatsApp: boolean
  address: string
  mapsUrl: string
  source: string
}

// 亚洲 / 东南亚 / 南亚 / 中亚 / 北非 各区域中心城市坐标
const REGION_CENTERS: Record<string, { city: string; lat: number; lng: number }[]> = {
  se: [
    { city: '曼谷', lat: 13.7563, lng: 100.5018 },
    { city: '雅加达', lat: -6.2088, lng: 106.8456 },
    { city: '胡志明', lat: 10.8231, lng: 106.6297 },
    { city: '吉隆坡', lat: 3.139, lng: 101.6869 },
    { city: '马尼拉', lat: 14.5995, lng: 120.9842 }
  ],
  sa: [
    { city: '新德里', lat: 28.6139, lng: 77.209 },
    { city: '达卡', lat: 23.8103, lng: 90.4125 },
    { city: '卡拉奇', lat: 24.8607, lng: 67.0011 },
    { city: '科伦坡', lat: 6.9271, lng: 79.8612 }
  ],
  ca: [
    { city: '阿拉木图', lat: 43.222, lng: 76.8512 },
    { city: '塔什干', lat: 41.2995, lng: 69.2401 },
    { city: '比什凯克', lat: 42.8746, lng: 74.5698 }
  ],
  na: [
    { city: '开罗', lat: 30.0444, lng: 31.2357 },
    { city: '卡萨布兰卡', lat: 33.5731, lng: -7.5898 },
    { city: '阿尔及尔', lat: 36.7538, lng: 3.0588 },
    { city: '突尼斯', lat: 36.8065, lng: 10.1815 }
  ]
}

const REGION_LABELS: Record<string, string> = { se: '东南亚', sa: '南亚', ca: '中亚', na: '北非' }

// 主要使用 WhatsApp 的国家区号（用于启发式标记）
// Overpass 公共实例间歇性过载，按序尝试多个节点，第一个成功即返回
const OSM_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
]

const WHATSAPP_CODES = [
  '+62', '+66', '+84', '+60', '+63', '+91', '+880', '+92', '+977', '+94',
  '+7', '+998', '+996', '+992', '+993', '+20', '+212', '+213', '+216', '+218', '+249'
]

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name)
  // 出网代理：仅 Google 请求走代理（避免影响本机 AI 服务 localhost 调用），懒加载避免多次创建
  private proxyFetch: typeof fetch | null = null

  async scrape(opts: ScrapeOptions): Promise<{ mode: string; leads: LeadData[] }> {
    const keyword = opts.keyword.trim()
    const types = opts.types?.filter(Boolean) || []
    const regions = opts.regions || ['se']
    const limit = Math.min(opts.limit || 10, 50)

    const mode = opts.mode || (process.env.GOOGLE_PLACES_API_KEY ? 'google' : 'demo')
    if (mode === 'demo') {
      this.logger.log('使用演示数据模式')
      return { mode: 'demo', leads: this.demoLeads(keyword, regions, types, limit) }
    }
    if (mode === 'osm') {
      this.logger.log('使用 OpenStreetMap Overpass 免费数据源（无需 API Key）')
      return { mode: 'osm', leads: await this.osmLeads(keyword, regions, types, limit) }
    }
    const key = process.env.GOOGLE_PLACES_API_KEY
    if (!key) {
      this.logger.warn('已选择 Google Places 但未配置 GOOGLE_PLACES_API_KEY，回退演示数据')
      return { mode: 'demo', leads: this.demoLeads(keyword, regions, types, limit) }
    }

    const gf = this.getFetch()
    // 真实 Google Places 抓取：Text Search + Place Details
    const leads: LeadData[] = []
    const centers = regions.flatMap((r) => REGION_CENTERS[r] || [])
    const perCenter = Math.max(1, Math.ceil(limit / Math.max(centers.length, 1)))

    for (const center of centers) {
      if (leads.length >= limit) break
      const query = `${keyword} ${types[0] || ''}`.trim()
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${center.lat},${center.lng}&radius=15000&language=en&key=${key}`
      const data = await this.getJson(gf, url)
      const results: any[] = data?.results || []
      for (const place of results.slice(0, perCenter)) {
        if (leads.length >= limit) break
        const detail = await this.getJson(
          gf,
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,url,name,formatted_address&language=en&key=${key}`
        )
        const d = detail?.result || {}
        const phone = d.formatted_phone_number || ''
        leads.push({
          name: d.name || place.name,
          type: types[0] || '',
          phone,
          website: d.website || '',
          region: REGION_LABELS[regions.find((r) => REGION_CENTERS[r]?.includes(center)) || ''] || '',
          city: center.city,
          hasWhatsApp: this.hasWhatsApp(phone),
          address: d.formatted_address || place.formatted_address || '',
          mapsUrl: d.url || '',
          source: 'google'
        })
      }
    }
    return { mode: 'google', leads }
  }

  private getFetch(): typeof fetch {
    if (this.proxyFetch) return this.proxyFetch
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    if (proxyUrl) {
      const dispatcher = new ProxyAgent(proxyUrl)
      this.logger.log(`出网请求（Google/OSM）将通过代理: ${proxyUrl}`)
      this.proxyFetch = (input: any, init: any) => fetch(input, { ...init, dispatcher })
    } else {
      this.proxyFetch = fetch
    }
    return this.proxyFetch
  }

  private hasWhatsApp(phone: string): boolean {
    const digits = (phone || '').replace(/[^0-9+]/g, '')
    if (!digits) return false
    const code = digits.startsWith('+') ? digits.slice(0, 4) : ''
    return WHATSAPP_CODES.some((c) => digits.startsWith(c.replace('+', '')) || code.startsWith(c))
  }

  private async getJson(gf: typeof fetch, url: string): Promise<any> {
    let res: Response
    try {
      res = await gf(url)
    } catch (e) {
      throw new Error(`Google Places 无法连接（请开启 Clash 代理，确认 7897 端口）: ${(e as Error).message}`)
    }
    if (!res.ok) throw new Error(`Google Places API 请求失败: ${res.status}`)
    return res.json()
  }

  // 无 API Key 时的演示数据（结构与真实抓取一致）
  private demoLeads(keyword: string, regions: string[], types: string[], limit: number): LeadData[] {
    const cities: Record<string, string[]> = {
      se: ['曼谷', '雅加达', '胡志明'], sa: ['新德里', '达卡'], ca: ['阿拉木图', '塔什干'], na: ['开罗', '拉巴特']
    }
    const samples = [
      'Sunrise Medical', 'Apex Pharma', 'GlobalCare Supply', 'MediWorld Trading', 'Wellness Clinic Supplies',
      'Prime Medico', 'BlueCross Medical', 'CarePoint Equipment', 'Lotus Pharma', 'Delta Medical Store'
    ]
    const type = types[0] || '医疗器械经销商'
    const out: LeadData[] = []
    let i = 0
    for (const r of regions) {
      for (const city of cities[r] || []) {
        if (out.length >= limit) break
        const name = `${samples[i % samples.length]} ${type}`
        const phone = `+${['66', '62', '91', '7', '20'][i % 5]}9${String(100000000 + i * 1373579 % 900000000).slice(0, 8)}`
        out.push({
          name, type,
          phone,
          website: `https://${samples[i % samples.length].toLowerCase().replace(/[^a-z]/g, '')}.com`,
          region: REGION_LABELS[r] || r,
          city,
          hasWhatsApp: i % 3 !== 2,
          address: `${city} · 演示地址`,
          mapsUrl: '',
          source: 'demo'
        })
        i++
      }
      if (out.length >= limit) break
    }
    return out.slice(0, limit)
  }
  // OpenStreetMap Overpass 免费数据源（无需 Key / 无需信用卡），同行业店铺真实数据
  private async osmLeads(keyword: string, regions: string[], types: string[], limit: number): Promise<LeadData[]> {
    const tagQueries = this.osmTypeQueries(types)
    const nameFilter = keyword ? `["name"~"${this.escRegex(keyword)}",i]` : ''
    const centers = regions.flatMap((r) => REGION_CENTERS[r] || [])
    const perCenter = Math.max(1, Math.ceil(limit / Math.max(centers.length, 1)))
    const leads: LeadData[] = []
    let failCount = 0
    for (const center of centers) {
      if (leads.length >= limit) break
      const parts = tagQueries.map((t) => `nwr[${t}]${nameFilter}(around:15000,${center.lat},${center.lng});`).join('\n')
      const q = `[out:json][timeout:25];(${parts});out tags center ${perCenter * 3};`
      let data: any
      try {
        data = await this.osmQuery(q)
      } catch (e) {
        // 单个城市失败（Overpass 过载/超时）不拖垮整批，记录后继续
        failCount++
        this.logger.warn(`[OSM] ${center.city} 抓取失败，已跳过: ${(e as Error).message}`)
        continue
      }
      for (const el of data?.elements || []) {
        if (leads.length >= limit) break
        const tags = el.tags || {}
        if (!tags.name) continue
        const lat = el.lat ?? el.center?.lat
        const lon = el.lon ?? el.center?.lon
        const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || ''
        leads.push({
          name: tags.name,
          type: types[0] || '',
          phone,
          website: tags.website || tags['contact:website'] || tags.url || '',
          region: REGION_LABELS[regions.find((r) => REGION_CENTERS[r]?.includes(center)) || ''] || '',
          city: center.city,
          hasWhatsApp: this.hasWhatsApp(phone),
          address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city'], tags['addr:country']].filter(Boolean).join(' '),
          mapsUrl: lat != null && lon != null ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}` : '',
          source: 'osm'
        })
      }
    }
    if (leads.length === 0 && failCount > 0) {
      throw new Error(`Overpass 抓取失败（${failCount} 个城市节点均不可用，服务过载或网络不通），请稍后重试`)
    }
    return leads.slice(0, limit)
  }

  private osmTypeQueries(types: string[]): string[] {
    const map: Record<string, string[]> = {
      '药店': ['shop=pharmacy', 'healthcare=pharmacy'],
      '诊所': ['amenity=clinic', 'healthcare=clinic'],
      '医院': ['amenity=hospital', 'healthcare=hospital'],
      '医疗器械经销商': ['shop=medical_supply'],
      '医疗耗材商店': ['shop=medical_supply']
    }
    const set = new Set<string>()
    for (const t of types) for (const q of map[t] || []) set.add(q)
    if (!set.size) {
      set.add('shop=medical_supply')
      set.add('amenity=clinic')
      set.add('amenity=hospital')
    }
    return [...set]
  }

  private async osmQuery(q: string): Promise<any> {
    let lastErr = ''
    for (const ep of OSM_ENDPOINTS) {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 25000)
      try {
        const res = await this.getFetch()(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: q }),
          signal: ac.signal
        })
        if (!res.ok) {
          lastErr = `${ep.replace('https://', '')} 返回 ${res.status}`
          continue
        }
        const data = await res.json().catch(() => null)
        if (data) return data
        lastErr = `${ep.replace('https://', '')} 返回数据异常`
      } catch (e) {
        lastErr = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      } finally {
        clearTimeout(timer)
      }
    }
    throw new Error(`Overpass 所有节点均不可用（服务过载或网络不通）: ${lastErr}`)
  }

  private escRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
