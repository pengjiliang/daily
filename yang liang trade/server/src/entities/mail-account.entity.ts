import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('mail_accounts')
export class MailAccount {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ default: '' })
  user: string

  @Column({ default: '' })
  pass: string

  @Column({ default: 'smtp.qq.com' })
  smtpHost: string

  @Column({ default: 465 })
  smtpPort: number

  @Column({ default: true })
  smtpSecure: boolean

  @Column({ default: 'imap.qq.com' })
  imapHost: string

  @Column({ default: 993 })
  imapPort: number

  @UpdateDateColumn()
  updatedAt: Date
}
