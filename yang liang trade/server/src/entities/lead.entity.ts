import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column({ default: '' })
  type: string

  @Column({ default: '' })
  phone: string

  @Column({ default: '' })
  website: string

  @Column({ default: '' })
  region: string

  @Column({ default: '' })
  city: string

  @Column({ default: false })
  hasWhatsApp: boolean

  @Column({ default: '' })
  address: string

  @Column({ default: '' })
  mapsUrl: string

  @Column({ default: 'google' })
  source: string

  @CreateDateColumn()
  createdAt: Date
}
