import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from './modules/auth/auth.module'
import { AiConfigModule } from './modules/ai-config/ai-config.module'
import { ChatModule } from './modules/chat/chat.module'
import { ProductsModule } from './modules/products/products.module'
import { LeadsModule } from './modules/leads/leads.module'
import { SeedService } from './seed.service'
import { User } from './entities/user.entity'
import { AiConfig } from './entities/ai-config.entity'
import { Product } from './entities/product.entity'
import { Lead } from './entities/lead.entity'
import { Campaign } from './entities/campaign.entity'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'yang_liang_base',
      entities: [User, AiConfig, Product, Lead, Campaign],
      synchronize: true
    }),
    TypeOrmModule.forFeature([User, AiConfig, Product, Lead, Campaign]),
    AuthModule,
    AiConfigModule,
    ChatModule,
    ProductsModule,
    LeadsModule
  ],
  providers: [SeedService]
})
export class AppModule {}
