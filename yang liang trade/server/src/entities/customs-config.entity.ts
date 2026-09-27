import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('customs_configs')
export class CustomsConfig {
  @PrimaryGeneratedColumn()
  id: number

  // 数据源模式：demo=演示数据（默认）| futian=富通天下真实源
  @Column({ default: 'demo' })
  mode: string

  // 富通天下账号配置（真实源，账号后补）
  @Column({ default: '' })
  futianUsername: string

  @Column({ default: '' })
  futianPassword: string
}
