import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ default: '' })
  name: string

  @Column({ default: '' })
  phone: string

  @Column('text')
  message: string

  @Column({ default: 'website' })
  source: string

  @CreateDateColumn()
  createdAt: Date
}