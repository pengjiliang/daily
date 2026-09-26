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
}
