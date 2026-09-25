// AI 客服产品知识库（基于公司产品资料做检索增强 RAG）
// 产品数据统一从 PostgreSQL products 表读取（server 启动时由 SeedService 写入），不再写死。
import { Client } from 'pg'

export interface KnowledgeDoc {
  text: string
  keywords: string
}

let docs: KnowledgeDoc[] = []

// 启动时从 PostgreSQL products 表加载产品资料（连接信息来自根目录 .env 的 DATABASE_*）
export async function loadKnowledge(): Promise<boolean> {
  try {
    const client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT) || 5432,
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'yang_liang_base'
    })
    await client.connect()
    const { rows } = await client.query(
      'SELECT name, "nameEn", "categoryLabel", spec, "desc", features FROM products ORDER BY id'
    )
    await client.end()
    docs = rows.map((p: any) => ({
      keywords: `${p.name} ${p.nameEn} ${p.categoryLabel} ${p.spec} ${p.features}`,
      text: `${p.name}（${p.nameEn}）：属于${p.categoryLabel}。规格：${p.spec}。${stripHtml(p.desc)} 特点：${p.features}。`
    }))
    console.log(`[knowledge] 已从数据库加载 ${docs.length} 条产品资料`)
    return true
  } catch (e: any) {
    // 数据库不可用时不阻塞服务启动（回复将仅基于公司简介）
    console.warn('[knowledge] 从数据库加载产品资料失败：', e?.message)
    return false
  }
}

// 关键词打分检索，取相关性最高的 3 条产品资料
export function retrieveKnowledge(question: string): string {
  const q = question.toLowerCase()
  const hits = docs
    .map((d) => ({ d, score: score(d, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  return hits.map((h) => h.d.text).join('\n')
}

function score(d: KnowledgeDoc, q: string): number {
  let s = 0
  const kws = d.keywords.toLowerCase().split(/[\s]+/)
  for (const kw of kws) if (kw && q.includes(kw)) s += 3
  const qParts = q.split(/[\s，。、,.，]+/).filter(Boolean)
  for (const part of qParts) if (d.text.toLowerCase().includes(part)) s += 1
  return s
}

// 富文本描述（含 HTML/图片/base64）转纯文本，避免污染检索与模型输入
function stripHtml(h: string): string {
  return (h || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export const companyIntro = '扬良贸易有限公司（YANGLIANG TRADE CO., LTD.）专注于医疗器械与医用产品进出口贸易，主营防护用品、监测设备、耗材器械、护理康复与消毒净化等品类，支持 OEM 定制，产品远销亚洲、东南亚、南亚、中亚、北非等地区。'


