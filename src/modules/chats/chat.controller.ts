import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  Query,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';
import {
  AddGroupMembersDto,
  CreateGroupDto,
  MessageReactionDto,
  SendMessageDto,
} from './chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
  ) {}

  @Post('send-message')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @User() user: UserWithoutPassword,
    @Body() body: SendMessageDto,
  ) {
    const result = await this.chatService.sendMessage(user.id, body);
    if (result.isGroup) {
      this.chatGateway.emitGroupMessage(
        result.chatId,
        result.socketPayload,
        result.participantUserIds,
      );
    } else if (result.recipientId) {
      this.chatGateway.emitPrivateMessage(
        user.id,
        result.recipientId,
        result.socketPayload,
      );
    }
    return { data: result.data };
  }

  /** Create a group chat — must be before `:chatId` routes. */
  @Post('groups')
  @HttpCode(HttpStatus.CREATED)
  createGroup(
    @User() user: UserWithoutPassword,
    @Body() body: CreateGroupDto,
  ) {
    return this.chatService.createGroup(user.id, body);
  }

  @Post('messages/:messageId/reactions')
  async addReaction(
    @User() user: UserWithoutPassword,
    @Param('messageId') messageId: string,
    @Body() body: MessageReactionDto,
  ) {
    const result = await this.chatService.addOrUpdateReaction(
      user.id,
      messageId,
      body.emoji,
    );
    this.chatGateway.emitReactionUpdated({
      chatId: result.chatId,
      messageId,
      reactions: result.data.reactions,
      actorUserId: user.id,
      participantUserIds: result.participantUserIds,
    });
    return { data: result.data };
  }

  @Delete('messages/:messageId/reactions')
  async removeReaction(
    @User() user: UserWithoutPassword,
    @Param('messageId') messageId: string,
  ) {
    const result = await this.chatService.removeReaction(user.id, messageId);
    this.chatGateway.emitReactionUpdated({
      chatId: result.chatId,
      messageId,
      reactions: result.data.reactions,
      actorUserId: user.id,
      participantUserIds: result.participantUserIds,
    });
    return { data: result.data };
  }

  @Get()
  getChats(
    @User() user: UserWithoutPassword,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.chatService.getChats(user.id, { page, limit });
  }

  @Get(':chatId')
  getChatById(
    @User() user: UserWithoutPassword,
    @Param('chatId') chatId: string,
  ) {
    return this.chatService.getChatById(user.id, chatId);
  }

  @Post(':chatId/members')
  addMembers(
    @User() user: UserWithoutPassword,
    @Param('chatId') chatId: string,
    @Body() body: AddGroupMembersDto,
  ) {
    return this.chatService.addGroupMembers(user.id, chatId, body.memberIds);
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
