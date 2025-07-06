import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ProfileModule } from './modules/profile/profile.module';
import { PostsModule } from './modules/posts/posts.module';
import { JwtGlobalModule } from './common/globals/jwt-global.module';
import { UploadModule } from './modules/upload/upload.module';
import { StatusModule } from './modules/status/status.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    ProfileModule,
    PostsModule,
    UploadModule,
    StatusModule,
    JwtGlobalModule,
    DatabaseModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
