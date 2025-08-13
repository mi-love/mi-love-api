import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ProfileModule } from './modules/profile/profile.module';
import { PostsModule } from './modules/posts/posts.module';
import { JwtGlobalModule } from './common/globals/jwt-global.module';
import { UploadModule } from './modules/upload/upload.module';
import { StatusModule } from './modules/status/status.module';
import { FriendsModule } from './modules/friends/friends.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { WalletModule } from './modules/wallet/wallet.module';
import { ChatModule } from './modules/chats/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      serveRoot: '/uploads',
      rootPath: join(__dirname, '..', 'uploads'),
    }),
    DatabaseModule,
    AuthModule,
    ProfileModule,
    PostsModule,
    UploadModule,
    StatusModule,
    JwtGlobalModule,
    FriendsModule,
    WalletModule,
    ChatModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
