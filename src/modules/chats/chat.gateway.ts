import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BadGatewayException, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsAuthGuard } from '@/common/guards/jwt-auth-ws.guard';
import { DbService } from '@/database/database.service';
import { NotificationService } from '../notifications/notification.service';
import { UserWithoutPassword } from '@/common/types/db';
import { file } from '@prisma/client';
@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private users = new Map<string, string>();
  private readonly logger = new Logger(ChatGateway.name);
  private readonly MESSAGE_FEE = 0.5;

  constructor(
    private jwtService: JwtService,
    private db: DbService,
    private notificationService: NotificationService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractTokenFromHeader(client);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      const user = await this.db.user.findUnique({
        where: {
          id: payload?.sub,
        },
        include: {
          wallet: true,
          profile_picture: true,
        },
      });
      client.data.user = user;
      if (user) {
        this.users.set(user.id, client.id);
        this.logger.log(`Connected client: ${client.id}, user: ${user.email}`);
        return;
      }
      throw new BadGatewayException({ message: 'User not found' });
    } catch {
      this.logger.warn(`Authentication failed for client: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user;
    if (user?.id) {
      this.users.delete(user.id as string);
    }
    this.logger.log(`Disconnected client: ${client.id}, user: ${user?.email}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('private-message')
  async handlePrivateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; message: string; fileId: string },
  ): Promise<void> {
    const fromUser = client.data.user as UserWithoutPassword & {
      profile_picture: file | null;
    };
    console.log('Sending message>>>');

    if (!data.toUserId || data.toUserId.trim() === '') {
      client.emit('error', { message: 'Invalid recipient user ID.' });
      return;
    }

    if (data.message && typeof data.message !== 'string') {
      client.emit('error', { message: 'Invalid message content.' });
      return;
    }

    if (data.fileId && typeof data.fileId !== 'string') {
      client.emit('error', { message: 'Invalid file ID.' });
      return;
    }

    const toSocketId = this.users.get(data.toUserId);
    // console.log(toSocketId)
    // will send if only only
    // if ((!data.message || !toSocketId)) return;

    const toUser = await this.db.user.findUnique({
      where: { id: data.toUserId },
    });

    if (!toUser) {
      client.emit('error', { message: 'Recipient user not found.' });
      return;
    }
    const isBlocked = await this.db.blocked_users.findFirst({
      where: {
        OR: [
          { userId: fromUser.id, blockedUserId: data.toUserId },
          { userId: data.toUserId, blockedUserId: fromUser.id },
        ],
      },
    });

    if (isBlocked) {
      client.emit('error', { message: 'You cannot message this user.' });
      return;
    }

    const isFriend = await this.db.user.findFirst({
      where: {
        id: fromUser.id,
        OR: [
          {
            friends: { some: { id: data.toUserId } },
          },
          {
            my_friends: { some: { id: data.toUserId } },
          },
        ],
      },
    });

    if (!isFriend) {
      client.emit('error', { message: 'You can only message friends.' });
      return;
    }

    let chat = await this.db.chat.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [fromUser.id, data.toUserId] },
          },
        },
      },
      include: { participants: true },
    });

    if (!chat) {
      chat = await this.db.chat.create({
        data: {
          participants: {
            create: [{ userId: fromUser.id }, { userId: data.toUserId }],
          },
        },
        include: { participants: true },
      });
    }

    if (!chat.can_send_messages) {
      client.emit('error', { message: 'Messaging is disabled in this chat.' });
      return;
    }

    const messageType = data.fileId ? 'file' : 'text';
    const { savedMessage } = await this.db.$transaction(async (tx) => {
      const savedMessage = await tx.message.create({
        data: {
          type: messageType,
          content: data.message,
          fileId: data.fileId,
          userId: fromUser.id,
          chatId: chat.id,
        },
        include: { file: true, user: true },
      });

      const wallet = await tx.wallet.findFirst({
        where: { id: fromUser.walletId },
      });

      if (Number(wallet?.balance) < this.MESSAGE_FEE) {
        client.emit('error', {
          message: 'Insufficient balance to send message.',
        });
        throw new BadGatewayException({
          message: 'Insufficient balance to send message.',
        });
      }
      await tx.wallet.update({
        where: { id: fromUser.walletId },
        data: { balance: { decrement: this.MESSAGE_FEE } },
      });
      // await tx.transaction.create({
      //   data: {
      //     amount: this.MESSAGE_FEE,
      //     type: 'debit',
      //     currency: 'USD',
      //     status:"success",
      //     description: 'Sent Message Fee',
      //     user: {
      //       connect: {
      //         id: fromUser.id,
      //       },
      //     },
      //   },
      // });

      return {
        savedMessage,
      };
    });

    const file = data?.fileId
      ? await this.db.file.findUnique({
          where: { id: data.fileId },
          select: { url: true, created_at: true },
        })
      : null;

    // @UTILS
    const truncateText = (text: string, maxLength: number) => {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength) + '...';
    };

    this.notificationService
      .sendNotification({
        title: `New message from ${fromUser.username}`,
        message: data?.message
          ? truncateText(data.message, 100)
          : 'Sent a file',
        type: 'message',
        userId: toUser.id,
        image: file ? file.url : fromUser?.profile_picture?.url,
      })
      .catch(() => {
        console.log('[FAILED TO SEND NOTIFICATION]');
      });
    if (toSocketId) {
      this.server.to(toSocketId).emit('private-message', {
        fromUserId: fromUser.id,
        fromUsername: fromUser.username,
        message: data.message,
        file,
        messageId: savedMessage.id,
      });
    }

    this.logger.log(
      `Message sent from user ${fromUser.id} to user ${data.toUserId}`,
    );
  }

  isUserConnected(userId: string): boolean {
    return this.users.has(userId);
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const [type, token] =
      client.handshake.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
