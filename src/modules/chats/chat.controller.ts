import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';
import { SendMessageDto } from './chat.dto';
import { PaginationUtils } from '@/common/services/pagination.service';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
    private readonly paginationUtils: PaginationUtils,
  ) {}

  @Post('send-message')
  sendMessage(@User() user: UserWithoutPassword, @Body() body: SendMessageDto) {
    return this.chatService.sendMessage(user.id, body);
  }

  @Get()
  getChats(
    @User() user: UserWithoutPassword,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.chatService.getChats(user.id, { page, limit });
  }

  @Get(':chatId/messages')
  getMessages(
    @User() user: UserWithoutPassword,
    @Param('chatId') chatId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.chatService.getMessages(user.id, chatId, { page, limit });
  }
}
