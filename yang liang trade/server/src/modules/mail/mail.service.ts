import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { MailAccount } from '../../entities/mail-account.entity'
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

  async send(dto: MailSendDto) {
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
    try {
      const info = await transport.sendMail({
        from: acc.user,
        to: to.join(', '),
        subject,
        text,
        html: String(text).replace(/\n/g, '<br>')
      })
      await this.campaigns.save({
        channel: 'email',
        count: to.length,
        status: '已发送',
        note: subject,
        detail: JSON.stringify({ to })
      })
      return { success: true, messageId: info.messageId }
    } finally {
      transport.close()
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

