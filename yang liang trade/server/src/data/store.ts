import * as fs from 'fs'
import * as path from 'path'

// 轻量 JSON 文件存储（演示阶段；后续迁移至 PostgreSQL + pgvector）
const DB_FILE = path.resolve(__dirname, '../../data/db.json')

export interface DbShape {
  users: { id: number; username: string; passwordHash: string; createdAt: string }[]
  aiConfigs: {
    id: number; name: string; type: string; baseURL: string; apiKey: string;
    model: string; systemPrompt: string; isDefault: boolean
  }[]
}

const EMPTY: DbShape = { users: [], aiConfigs: [] }

export function readDb(): DbShape {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8')
    return { ...EMPTY, ...JSON.parse(raw) }
  } catch {
    return { users: [], aiConfigs: [] }
  }
}

export function writeDb(db: DbShape) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}
