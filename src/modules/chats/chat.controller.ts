import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';
import { SendMessageDto } from './chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
  ) {}

  @Post('send-message')
  sendMessage(@User() user: UserWithoutPassword, @Body() body: SendMessageDto) {
    return this.chatService.sendMessage(user.id, body);
  }
}
