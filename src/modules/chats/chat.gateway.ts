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
import { BadGatewayException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsAuthGuard } from '@/common/guards/jwt-auth-ws.guard';
import { DbService } from '@/database/database.service';
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

  constructor(
    private jwtService: JwtService,
    private db: DbService,
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
        },
      });
      client.data.user = user;
      if (user) {
        this.users.set(user.id, client.id);
        console.log('> Connected client:', client.id, user?.email);
        return;
      }
      throw new BadGatewayException({ message: 'User not found' });
    } catch {
      console.log('> Authentication failed for client:', client.id);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user;
    if (user?.id) {
      this.users.delete(user.id as string);
    }
    console.log('> Disconnected client:', client.id, user?.email);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('private-message')
  async handlePrivateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; message: string; fileId: string },
  ): Promise<void> {
    console.log('first');
    const fromUser = client.data.user;
    const toSocketId = this.users.get(data.toUserId);
    if ((!data.message && !data.fileId) || !toSocketId) return;

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

    const isFriend =
      (await this.db.user.findFirst({
        where: {
          id: fromUser.id,
          friends: { some: { id: data.toUserId } },
        },
      })) ||
      (await this.db.user.findFirst({
        where: {
          id: data.toUserId,
          friends: { some: { id: fromUser.id } },
        },
      }));

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
    console.log('sending', messageType);
    const { savedMessage } = await this.db.$transaction(async (tx) => {
      console.log('OGO Power');
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

      console.log(wallet);
      if (Number(wallet?.balance) < 0.5) {
        this.server
          .to(client.id)
          .emit('error', { message: 'Insufficient balance to send message.' });
        throw new BadGatewayException({
          message: 'Insufficient balance to send message.',
        });
      }
      await tx.wallet.update({
        where: { id: fromUser.walletId },
        data: { balance: { decrement: 0.5 } },
      });
      // await tx.transaction.create({
      //   data: {
      //     amount: 0.5,
      //     type: 'debit',
      //     currency: 'USD',
      //     description: 'Sent Message',
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

    this.server.to(toSocketId).emit('private-message', {
      fromUserId: fromUser.id,
      fromUsername: fromUser.username,
      message: data.message,
      file,
      messageId: savedMessage.id,
    });
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
