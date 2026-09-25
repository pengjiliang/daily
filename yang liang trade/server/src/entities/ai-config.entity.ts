import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('ai_configs')
export class AiConfig {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  type: string

  @Column()
  baseURL: string

  @Column()
  apiKey: string

  @Column()
  model: string

  @Column('text')
  systemPrompt: string

  @Column({ default: false })
  isDefault: boolean
}
