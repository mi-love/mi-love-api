import { BadGatewayException, Injectable } from '@nestjs/common';
import { SendMessageDto } from './chat.dto';
import { DbService } from '@/database/database.service';
import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly db: DbService,
    private readonly paginationUtils: PaginationUtils,
  ) {}

  async sendMessage(userId: string, body: SendMessageDto) {
    const { message, fileId } = body;

    if (!message && !fileId) {
      throw new BadGatewayException({
        message: 'No message or fileId provided',
      });
    }
  }

  async getChats(userId: string, pagination: PaginationParams) {
    const { skip, limit } = this.paginationUtils.getPagination(pagination);

    const chats = await this.db.chat.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                first_name: true,
                last_name: true,
                profile_picture: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            created_at: 'desc',
          },
          take: 1, // Last message
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            file: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        updated_at: 'desc',
      },
    });

    const total = await this.db.chat.count({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
    });

    return {
      data: chats,
      meta: this.paginationUtils.getMeta({ totalItems: total, ...pagination }),
    };
  }

  async getMessages(
    userId: string,
    chatId: string,
    pagination: { page: string; limit: string },
  ) {
    const participant = await this.db.chat.findFirst({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
    });

    if (!participant) {
      throw new BadGatewayException({
        message: 'You are not a participant in this chat.',
      });
    }

    const { skip, limit } = this.paginationUtils.getPagination(pagination);

    const messages = await this.db.message.findMany({
      where: {
        chatId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            first_name: true,
            last_name: true,
            profile_picture: true,
          },
        },
        file: true,
      },
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });

    const total = await this.db.message.count({
      where: {
        chatId,
      },
    });

    return {
      data: messages,
      meta: this.paginationUtils.getMeta({ totalItems: total, ...pagination }),
    };
  }
}
