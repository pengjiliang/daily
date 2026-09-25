import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  channel: string

  @Column()
  count: number

  @Column({ default: '' })
  status: string

  @Column({ default: '' })
  note: string

  @Column('text', { default: '' })
  detail: string

  @CreateDateColumn()
  createdAt: Date
}
