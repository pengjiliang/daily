import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import configuration from './config/configuration.js';
import { UsersModule } from './users/users.module.js';
import { UploadModule } from './upload/upload.module.js';
import { ChatModule } from './chat/chat.module.js';

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
        autoLoadEntities: true,
        synchronize: configService.getOrThrow<boolean>('database.synchronize'),
      }),
    }),
    UsersModule,
    AuthModule,
    UploadModule,
    ChatModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
