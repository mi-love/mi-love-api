import { Controller, Post, UseGuards } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(private readonly chatGateway: ChatGateway) {}

  @Post('send-message')
  sendMessage(): string {
    this.chatGateway.handleMessage({ id: 'test-client' } as any, 'Hello World');
    return 'Message sent';
  }
}
