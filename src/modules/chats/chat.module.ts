import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { DbService } from '@/database/database.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, DbService, JwtService],
  exports: [],
})
export class ChatModule {}
