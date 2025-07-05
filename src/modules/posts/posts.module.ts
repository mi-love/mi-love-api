import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { JwtService } from '@nestjs/jwt';
import { PaginationUtils } from '@/common/services/pagination.service';

@Module({
  imports: [],
  controllers: [PostsController],
  providers: [PostsService, JwtService, PaginationUtils],
})
export class PostsModule {}
