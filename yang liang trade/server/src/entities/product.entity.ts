import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  nameEn: string

  @Column()
  category: string

  @Column()
  categoryLabel: string

  @Column()
  spec: string

  @Column('text')
  desc: string

  @Column('simple-array')
  features: string[]

  @Column()
  image: string
}
