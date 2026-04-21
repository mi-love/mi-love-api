import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  ListChatsQueryDto,
  ListMessagesQueryDto,
  DeleteMessageDto,
  ArchiveChatDto,
  ChatStatisticsDto,
  PaginatedChatsResponseDto,
  PaginatedMessagesResponseDto,
  BulkDeleteMessagesDto,
} from '../dtos/chat-management.dto';

@Injectable()
export class AdminChatManagementService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async listChats(
    query: ListChatsQueryDto,
    adminId: string,
  ): Promise<PaginatedChatsResponseDto> {
    const { page = 1, limit = 20, userId, search, startDate, endDate } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    let chats: any[] = [];
    let total = 0;

    if (userId) {
      // Get chats for specific user
      chats = await this.db.chat.findMany({
        where: {
          ...where,
          participant: {
            some: { userId },
          },
        },
        skip,
        take: limit,
        include: {
          participant: {
            include: {
              user: { select: { id: true, email: true, username: true, profile_picture: true } },
            },
          },
          messages: {
            select: { id: true },
          },
        },
        orderBy: { updated_at: 'desc' },
      });

      total = await this.db.chat.count({
        where: {
          ...where,
          participant: {
            some: { userId },
          },
        },
      });
    } else {
      chats = await this.db.chat.findMany({
        where,
        skip,
        take: limit,
        include: {
          participant: {
            include: {
              user: { select: { id: true, email: true, username: true, profile_picture: true } },
            },
          },
          messages: {
            select: { id: true, created_at: true },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        orderBy: { updated_at: 'desc' },
      });

      total = await this.db.chat.count({ where });
    }

    const formattedChats = chats.map((chat: any) => ({
      id: chat.id,
      participants: chat.participant.map((p: any) => ({
        id: p.user.id,
        email: p.user.email,
        username: p.user.username,
        avatar: p.user.profile_picture,
      })),
      messageCount: chat.messages.length,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      lastMessageAt: chat.messages[0]?.created_at,
      isActive: true,
    }));

    this.logger.log(`Listed ${chats.length} chats`, 'AdminChatManagementService');

    return {
      data: formattedChats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async listMessagesInChat(
    chatId: string,
    query: ListMessagesQueryDto,
    adminId: string,
  ): Promise<PaginatedMessagesResponseDto> {
    const { page = 1, limit = 50, search, startDate, endDate } = query;

    const chat = await this.db.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException(`Chat ${chatId} not found`);
    }

    const skip = (page - 1) * limit;
    const where: any = { chat_id: chatId };

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const [messages, total] = await Promise.all([
      this.db.message.findMany({
        where,
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, email: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.db.message.count({ where }),
    ]);

    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      chatId: msg.chat_id,
      senderId: msg.sender_id,
      senderName: msg.sender.username,
      content: msg.content,
      type: msg.type,
      fileUrl: msg.file_url,
      read: msg.is_read,
      readAt: msg.read_at,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
    }));

    this.logger.log(`Listed ${messages.length} messages in chat ${chatId}`, 'AdminChatManagementService');

    return {
      data: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async deleteMessage(
    messageId: string,
    data: DeleteMessageDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const message = await this.db.message.findUnique({ where: { id: messageId } });

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (data.isHardDelete) {
      await this.db.message.delete({ where: { id: messageId } });
    } else {
      await this.db.message.update({
        where: { id: messageId },
        data: { content: '[Message deleted by moderator]', is_deleted: true },
      });
    }

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'DELETE_MESSAGE',
        resource: 'message',
        resource_id: messageId,
        metadata: { reason: data.reason, isHardDelete: data.isHardDelete, chatId: message.chat_id },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'DELETE_MESSAGE',
      'message',
      messageId,
      data,
    );

    return { message: `Message ${messageId} has been deleted` };
  }

  async bulkDeleteMessages(
    data: BulkDeleteMessagesDto,
    adminId: string,
  ): Promise<{ message: string; deletedCount: number }> {
    const messages = await this.db.message.findMany({
      where: { id: { in: data.messageIds } },
    });

    if (messages.length === 0) {
      throw new NotFoundException('No messages found');
    }

    await this.db.message.updateMany({
      where: { id: { in: data.messageIds } },
      data: { content: '[Message deleted by moderator]', is_deleted: true },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'BULK_DELETE_MESSAGES',
        resource: 'message',
        resource_id: data.messageIds.join(','),
        metadata: { count: data.messageIds.length, reason: data.reason },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'BULK_DELETE_MESSAGES',
      'message',
      'bulk',
      { count: data.messageIds.length },
    );

    return { message: `${messages.length} messages deleted`, deletedCount: messages.length };
  }

  async archiveChat(
    chatId: string,
    data: ArchiveChatDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const chat = await this.db.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      throw new NotFoundException(`Chat ${chatId} not found`);
    }

    await this.db.chat.update({
      where: { id: chatId },
      data: { is_archived: true },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'ARCHIVE_CHAT',
        resource: 'chat',
        resource_id: chatId,
        metadata: { reason: data.reason },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'ARCHIVE_CHAT',
      'chat',
      chatId,
      data,
    );

    return { message: `Chat ${chatId} has been archived` };
  }

  async getChatStatistics(adminId: string): Promise<ChatStatisticsDto> {
    const [totalChats, archivedChats, totalMessages] = await Promise.all([
      this.db.chat.count(),
      this.db.chat.count({ where: { is_archived: true } }),
      this.db.message.count(),
    ]);

    const activeChats = totalChats - archivedChats;

    // Get top participants
    const topParticipants = await this.db.message.groupBy({
      by: ['sender_id'],
      _count: true,
      orderBy: { _count: { sender_id: 'desc' } },
      take: 5,
    });

    const participantDetails = await Promise.all(
      topParticipants.map(async (p: any) => {
        const user = await this.db.user.findUnique({
          where: { id: p.sender_id },
          select: { id: true, username: true },
        });
        return {
          userId: p.sender_id,
          username: user?.username || 'Unknown',
          messageCount: p._count,
        };
      }),
    );

    // Get average message length
    const messageStats = await this.db.message.aggregate({
      _avg: { content: true },
      _count: true,
    });

    // Get messages per day
    const messagesPerDay = totalMessages > 0 ? Math.round(totalMessages / 30) : 0;

    this.logger.log(`Retrieved chat statistics`, 'AdminChatManagementService');

    return {
      totalChats,
      activeChats,
      archivedChats,
      totalMessages,
      messagesPerDay,
      topChatParticipants: participantDetails,
    };
  }

  async getMessageStatisticsByUser(
    userId: string,
    adminId: string,
  ): Promise<{ totalMessages: number; chatsParticipated: number; lastMessageAt?: Date }> {
    const [totalMessages, chatsParticipated] = await Promise.all([
      this.db.message.count({ where: { sender_id: userId } }),
      this.db.chat.count({
        where: { participant: { some: { userId } } },
      }),
    ]);

    const lastMessage = await this.db.message.findFirst({
      where: { sender_id: userId },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    this.logger.log(
      `Retrieved message statistics for user ${userId}`,
      'AdminChatManagementService',
    );

    return {
      totalMessages,
      chatsParticipated,
      lastMessageAt: lastMessage?.created_at,
    };
  }
}
