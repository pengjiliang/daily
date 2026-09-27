import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as nodemailer from 'nodemailer'
import { randomUUID } from 'crypto'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { MailAccount } from '../../entities/mail-account.entity'

// 兼容网易等「专属邮箱」前缀：m15292252509@163.com 与 15292252509@163.com 视为同一邮箱
export function sameMail(a: string, b: string): boolean {
  if (!a || !b || a === b) return a === b
  const la = a.split('@')[0]
  const lb = b.split('@')[0]
  const da = a.split('@')[1] || ''
  const db = b.split('@')[1] || ''
  if (da !== db) return false
  const norm = (x: string) => x.replace(/^[a-z]+/i, '')
  const na = norm(la)
  const nb = norm(lb)
  return !!na && !!nb && na.length >= 3 && na === nb
}
import { Campaign } from '../../entities/campaign.entity'

export interface MailLoginDto {
  user: string
  pass: string
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  imapHost?: string
  imapPort?: number
}

export interface MailSendDto {
  to: string[]
  subject: string
  text: string
}

@Injectable()
export class MailService {
  constructor(
    @InjectRepository(MailAccount) private accounts: Repository<MailAccount>,
    @InjectRepository(Campaign) private campaigns: Repository<Campaign>
  ) {}

  private async account() {
    let acc = await this.accounts.findOne({ where: { id: 1 } })
    if (!acc) {
      acc = this.accounts.create({ id: 1 })
      acc = await this.accounts.save(acc)
    }
    return acc
  }

  async getConfig() {
    const acc = await this.account()
    const hasAccount = !!(acc.user && acc.pass)
    return {
      hasAccount,
      user: hasAccount ? acc.user.replace(/^(.)[^@]*@/, '$1***@') : '',
      smtpHost: acc.smtpHost,
      smtpPort: acc.smtpPort,
      smtpSecure: acc.smtpSecure,
      imapHost: acc.imapHost,
      imapPort: acc.imapPort,
      updatedAt: acc.updatedAt
    }
  }

  async login(dto: MailLoginDto) {
    const user = String(dto.user || '').trim()
    const pass = String(dto.pass || '')
    if (!user || !pass) throw new BadRequestException('请填写邮箱账号和授权码')
    const acc = await this.account()
    acc.user = user
    acc.pass = pass
    acc.smtpHost = String(dto.smtpHost || 'smtp.qq.com').trim()
    acc.smtpPort = Number(dto.smtpPort) || 465
    acc.smtpSecure = (Number(dto.smtpPort) || 465) === 465
    acc.imapHost = String(dto.imapHost || 'imap.qq.com').trim()
    acc.imapPort = Number(dto.imapPort) || 993

    await this.testSmtp(acc).catch((e) => {
      throw new BadRequestException('SMTP 连接失败：' + ((e as Error).message || e))
    })
    await this.testImap(acc).catch((e) => {
      throw new BadRequestException('IMAP 连接失败：' + ((e as Error).message || e))
    })
    await this.accounts.save(acc)
    return { success: true }
  }

  async remove() {
    const acc = await this.account()
    acc.user = ''
    acc.pass = ''
    await this.accounts.save(acc)
    return { success: true }
  }

  async inbox(limitValue?: string) {
    const acc = await this.account()
    if (!acc.user || !acc.pass) throw new BadRequestException('请先登录邮箱')
    const n = Math.min(50, Math.max(1, Math.floor(Number(limitValue) || 20)))

    const client = new ImapFlow({
      host: acc.imapHost,
      port: acc.imapPort,
      secure: true,
      auth: { user: acc.user, pass: acc.pass },
      logger: false
    })
    try {
      await client.connect()
      const lock = await client.getMailboxLock('INBOX')
      try {
        const status = await client.status('INBOX', { messages: true })
        const total = status.messages
        if (!total) return { total: 0, items: [] }
        const from = Math.max(1, total - n + 1)
        const items: Array<{ uid: number; date: string | null; subject: string; from: string; preview: string }> = []
        for await (const msg of client.fetch(`${from}:*`, { envelope: true, source: true })) {
          let subject = ''
          let fromText = ''
          let text = ''
          try {
            const parsed = await simpleParser(msg.source)
            subject = parsed.subject || ''
            fromText = parsed.from?.text || ''
            text = String(parsed.text || '').replace(/\s+/g, ' ').trim()
          } catch {
            /* 忽略单封解析失败 */
          }
          items.push({
            uid: msg.uid,
            date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
            subject,
            from: fromText,
            preview: text.slice(0, 200)
          })
        }
        items.reverse()
        return { total, items }
      } finally {
        lock.release()
      }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async send(dto: MailSendDto, baseUrl: string) {
    const acc = await this.account()
    if (!acc.user || !acc.pass) throw new BadRequestException('请先登录邮箱')
    const to = (Array.isArray(dto.to) ? dto.to : []).map((t) => String(t).trim()).filter(Boolean)
    const subject = String(dto.subject || '').trim()
    const text = String(dto.text || '')
    if (!to.length) throw new BadRequestException('请至少填写一个收件人邮箱')
    if (!subject) throw new BadRequestException('请填写邮件主题')
    if (!text) throw new BadRequestException('请填写邮件正文')

    const transport = nodemailer.createTransport({
      host: acc.smtpHost,
      port: acc.smtpPort,
      secure: acc.smtpSecure,
      auth: { user: acc.user, pass: acc.pass }
    })
    const trackBase = String(process.env.MAIL_TRACK_BASE_URL || '').replace(/\/+$/, '') || baseUrl
    try {
      // 每个收件人单独发送并携带唯一追踪像素：打开邮件即标记“已查看”
      const recipients = to.map((email) => ({ email, token: randomUUID(), readAt: null }))
      for (const r of recipients) {
        const img = '<img src="' + trackBase + '/api/mail/track/' + r.token + '" width="1" height="1" alt="" />'
        const html = String(text).replace(/\n/g, '<br>') + img
        await transport.sendMail({ from: acc.user, to: r.email, subject, text, html })
      }
      await this.campaigns.save({
        channel: 'email',
        count: to.length,
        status: '已发送',
        note: subject,
        detail: JSON.stringify({ recipients })
      })
      return { success: true }
    } finally {
      transport.close()
    }
  }

  async message(uidValue: string) {
    const acc = await this.account()
    if (!acc.user || !acc.pass) throw new BadRequestException('请先登录邮箱')
    const uid = Number(uidValue)
    if (!uid) throw new BadRequestException('缺少邮件 uid')
    const client = new ImapFlow({
      host: acc.imapHost,
      port: acc.imapPort,
      secure: true,
      auth: { user: acc.user, pass: acc.pass },
      logger: false
    })
    try {
      await client.connect()
      const lock = await client.getMailboxLock('INBOX')
      try {
        for await (const msg of client.fetch(uid, { envelope: true, source: true })) {
          let subject = ''
          let fromText = ''
          let text = ''
          try {
            const parsed = await simpleParser(msg.source)
            subject = parsed.subject || ''
            fromText = parsed.from?.text || ''
            text = String(parsed.text || '').replace(/\s+/g, ' ').trim()
          } catch {
            /* 忽略单封解析失败 */
          }
          return {
            uid: msg.uid,
            date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
            subject,
            from: fromText,
            preview: text.slice(0, 200)
          }
        }
        throw new BadRequestException('未找到该邮件')
      } finally {
        lock.release()
      }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async checkReplies() {
    const acc = await this.account()
    if (!acc.user || !acc.pass) throw new BadRequestException('请先登录邮箱')
    const client = new ImapFlow({
      host: acc.imapHost,
      port: acc.imapPort,
      secure: true,
      auth: { user: acc.user, pass: acc.pass },
      logger: false
    })
    let replied = 0
    try {
      await client.connect()
      const lock = await client.getMailboxLock('INBOX')
      try {
        const status = await client.status('INBOX', { messages: true })
        const total = status.messages
        if (total) {
          const from = Math.max(1, total - 199)
          const campaigns = await this.campaigns.find()
          for await (const msg of client.fetch(`${from}:*`, { envelope: true })) {
            const subject = String(msg.envelope?.subject || '').trim()
            // 循环剥除常见回复前缀（可叠加）：Re: / 回复： / 答复： / AW: / SV: / Fw: 等
            let clean = subject
            for (let i = 0; i < 3; i++) {
              const m = clean.match(/^\s*(?:re|回复|答复|aw|sv|ref|fw|转发)\s*[:：]?\s*/i)
              if (!m) break
              clean = clean.slice(m[0].length).trim()
            }
            if (clean === subject) continue // 无回复前缀，跳过
            const fromAddr = String(msg.envelope?.from?.[0]?.address || '').toLowerCase()
            for (const c of campaigns) {
              if (!c.detail) continue
              let d
              try { d = JSON.parse(c.detail) } catch { continue }
              const note = String(c.note || '').trim()
              const rec = (d.recipients || []).find((x) =>
                !x.repliedAt &&
                sameMail(String(x.email).toLowerCase(), fromAddr) &&
                (clean === note || clean.startsWith(note.slice(0, 20)) || note.startsWith(clean.slice(0, 20)))
              )
              if (rec) {
                rec.repliedAt = new Date().toISOString()
                rec.replyUid = msg.uid
                c.detail = JSON.stringify(d)
                await this.campaigns.update(c.id, { detail: c.detail })
                replied++
              }
            }
          }
        }
      } finally {
        lock.release()
      }
    } finally {
      await client.logout().catch(() => {})
    }
    return { replied }
  }

  async track(token: string) {
    if (!token) return
    const rows = await this.campaigns.find()
    for (const c of rows) {
      if (!c.detail) continue
      try {
        const d = JSON.parse(c.detail)
        const rec = (d.recipients || []).find((x) => x.token === token)
        if (rec && !rec.readAt) {
          rec.readAt = new Date().toISOString()
          await this.campaigns.update(c.id, { detail: JSON.stringify(d) })
          return
        }
      } catch {
        /* 忽略旧格式记录 */
      }
    }
  }
  private async testSmtp(acc: MailAccount) {
    const transport = nodemailer.createTransport({
      host: acc.smtpHost,
      port: acc.smtpPort,
      secure: acc.smtpSecure,
      auth: { user: acc.user, pass: acc.pass }
    })
    try {
      await transport.verify()
    } finally {
      transport.close()
    }
  }

  private async testImap(acc: MailAccount) {
    const client = new ImapFlow({
      host: acc.imapHost,
      port: acc.imapPort,
      secure: true,
      auth: { user: acc.user, pass: acc.pass },
      logger: false
    })
    try {
      await client.connect()
    } finally {
      await client.logout().catch(() => {})
    }
  }
}

