import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { DbService } from '@/database/database.service';
import { JwtService } from '@nestjs/jwt';
import { PaginationUtils } from '@/common/services/pagination.service';

@Module({
  imports: [],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, DbService, JwtService, PaginationUtils],
  exports: [],
})
export class ChatModule {}
