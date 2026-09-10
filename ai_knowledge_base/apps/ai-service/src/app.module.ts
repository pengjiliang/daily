import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AIModule } from './ai/ai.module.js';
import configuration from './config/configuration.js';
import { DocumentChunk } from './entities/document-chunk.entity.js';
import { DatabaseInitializationService } from './services/database-initialization.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('database.host'),
        port: configService.getOrThrow<number>('database.port'),
        username: configService.getOrThrow<string>('database.username'),
        password: configService.getOrThrow<string>('database.password'),
        database: configService.getOrThrow<string>('database.name'),
        entities: [DocumentChunk],
        synchronize: false,
      }),
    }),
    AIModule,
  ],
  controllers: [AppController],
  providers: [DatabaseInitializationService],
})
export class AppModule {}
