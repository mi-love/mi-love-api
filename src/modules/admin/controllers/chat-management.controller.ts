import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../../common/guards/admin-role.guard';
import { User } from '../../../common/decorator/user.decorator';
import { AdminChatManagementService } from '../services/chat-management.service';
import {
  ListChatsQueryDto,
  ListMessagesQueryDto,
  DeleteMessageDto,
  ArchiveChatDto,
  BulkDeleteMessagesDto,
} from '../dtos/chat-management.dto';

@Controller('admin/chats')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminChatManagementController {
  constructor(private chatService: AdminChatManagementService) {}

  @Get()
  async listChats(@Query() query: ListChatsQueryDto, @User() user: any) {
    return this.chatService.listChats(query, user.id);
  }

  @Get('statistics')
  async getChatStatistics(@User() user: any) {
    return this.chatService.getChatStatistics(user.id);
  }

  @Get(':chatId/messages')
  async listMessages(
    @Param('chatId') chatId: string,
    @Query() query: ListMessagesQueryDto,
    @User() user: any,
  ) {
    return this.chatService.listMessagesInChat(chatId, query, user.id);
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Body() data: DeleteMessageDto,
    @User() user: any,
  ) {
    return this.chatService.deleteMessage(messageId, data, user.id);
  }

  @Post('messages/bulk-delete')
  async bulkDeleteMessages(
    @Body() data: BulkDeleteMessagesDto,
    @User() user: any,
  ) {
    return this.chatService.bulkDeleteMessages(data, user.id);
  }

  @Patch(':chatId/archive')
  async archiveChat(
    @Param('chatId') chatId: string,
    @Body() data: ArchiveChatDto,
    @User() user: any,
  ) {
    return this.chatService.archiveChat(chatId, data, user.id);
  }

  @Get('user/:userId/statistics')
  async getUserMessageStatistics(
    @Param('userId') userId: string,
    @User() user: any,
  ) {
    return this.chatService.getMessageStatisticsByUser(userId, user.id);
  }
}
