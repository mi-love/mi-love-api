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
import { UserWithoutPassword } from '@/common/types/db';
import { file } from '@prisma/client';
import { ChatService } from './chat.service';
import { extractSocketToken } from '@/common/utils/socket-auth';

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

  constructor(
    private jwtService: JwtService,
    private db: DbService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = extractSocketToken(client);

      if (!token) {
        this.logger.warn(
          `Socket ${client.id}: connect rejected (no token in headers.authorization or handshake.auth)`,
        );
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'secret',
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
        this.attachSocketRequestLogging(client, user.id);
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

  private chatRoom(chatId: string) {
    return `chat:${chatId}`;
  }

  emitPrivateMessage(
    fromUserId: string,
    toUserId: string,
    payload: Record<string, unknown>,
  ) {
    const targets = new Set(
      [this.users.get(toUserId), this.users.get(fromUserId)].filter(
        (id): id is string => Boolean(id),
      ),
    );
    for (const socketId of targets) {
      this.server.to(socketId).emit('private-message', payload);
    }
  }

  /** Emit to Socket.IO room + any online participants (covers clients not in room yet). */
  emitGroupMessage(
    chatId: string,
    payload: Record<string, unknown>,
    participantUserIds: string[],
  ) {
    this.server.to(this.chatRoom(chatId)).emit('chat-message', payload);
    for (const userId of participantUserIds) {
      const socketId = this.users.get(userId);
      if (socketId) {
        this.server.to(socketId).emit('chat-message', payload);
      }
    }
  }

  emitReactionUpdated(params: {
    chatId: string;
    messageId: string;
    reactions: unknown[];
    actorUserId: string;
    participantUserIds: string[];
  }) {
    const payload = {
      chatId: params.chatId,
      messageId: params.messageId,
      reactions: params.reactions,
      actorUserId: params.actorUserId,
    };
    this.server
      .to(this.chatRoom(params.chatId))
      .emit('message-reaction-updated', payload);
    for (const userId of params.participantUserIds) {
      const socketId = this.users.get(userId);
      if (socketId) {
        this.server.to(socketId).emit('message-reaction-updated', payload);
      }
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('join-chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ): Promise<void> {
    const user = client.data.user as UserWithoutPassword;
    try {
      if (!data?.chatId) {
        client.emit('error', { message: 'chatId is required' });
        return;
      }
      await this.chatService.assertChatParticipant(user.id, data.chatId);
      await client.join(this.chatRoom(data.chatId));
      this.logger.log(
        `User ${user.id} joined room ${this.chatRoom(data.chatId)}`,
      );
    } catch (err: any) {
      const message =
        err?.response?.message || err?.message || 'Failed to join chat';
      client.emit('error', {
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('leave-chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ): Promise<void> {
    if (!data?.chatId) return;
    await client.leave(this.chatRoom(data.chatId));
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat-message')
  async handleGroupMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatId: string;
      message?: string;
      fileId?: string;
      replyToMessageId?: string;
    },
  ): Promise<void> {
    const fromUser = client.data.user as UserWithoutPassword;

    try {
      if (!data?.chatId) {
        client.emit('error', { message: 'chatId is required' });
        return;
      }

      const result = await this.chatService.sendMessage(fromUser.id, {
        chatId: data.chatId,
        message: data.message,
        fileId: data.fileId,
        replyToMessageId: data.replyToMessageId,
      });

      if (!result.isGroup) {
        client.emit('error', {
          message: 'chat-message is only for group chats; use private-message',
        });
        return;
      }

      this.emitGroupMessage(
        result.chatId,
        result.socketPayload,
        result.participantUserIds,
      );
    } catch (err: any) {
      const message =
        err?.response?.message || err?.message || 'Failed to send message';
      client.emit('error', {
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('private-message')
  async handlePrivateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      toUserId: string;
      message?: string;
      fileId?: string;
      replyToMessageId?: string;
    },
  ): Promise<void> {
    const fromUser = client.data.user as UserWithoutPassword & {
      profile_picture: file | null;
    };

    try {
      if (!data.toUserId || data.toUserId.trim() === '') {
        client.emit('error', { message: 'Invalid recipient user ID.' });
        return;
      }

      const result = await this.chatService.sendMessage(fromUser.id, {
        toUserId: data.toUserId,
        message: data.message,
        fileId: data.fileId,
        replyToMessageId: data.replyToMessageId,
      });

      if (result.recipientId) {
        this.emitPrivateMessage(
          fromUser.id,
          result.recipientId,
          result.socketPayload,
        );
      }

      this.logger.log(
        `Message sent from user ${fromUser.id} to user ${data.toUserId}`,
      );
    } catch (err: any) {
      const message =
        err?.response?.message || err?.message || 'Failed to send message';
      client.emit('error', {
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('message-reaction')
  async handleMessageReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; emoji: string | null },
  ): Promise<void> {
    const fromUser = client.data.user as UserWithoutPassword;

    try {
      if (!data.messageId) {
        client.emit('error', { message: 'messageId is required' });
        return;
      }

      const result =
        data.emoji == null
          ? await this.chatService.removeReaction(fromUser.id, data.messageId)
          : await this.chatService.addOrUpdateReaction(
              fromUser.id,
              data.messageId,
              data.emoji,
            );

      this.emitReactionUpdated({
        chatId: result.chatId,
        messageId: data.messageId,
        reactions: result.data.reactions,
        actorUserId: fromUser.id,
        participantUserIds: result.participantUserIds,
      });
    } catch (err: any) {
      const message =
        err?.response?.message || err?.message || 'Failed to update reaction';
      client.emit('error', {
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('call')
  async handleInitiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; callId: string },
  ): Promise<void> {
    const fromUser = client.data.user as UserWithoutPassword & {
      profile_picture: file | null;
    };

    if (!data.toUserId || data.toUserId.trim() === '') {
      client.emit('error', { message: 'Invalid recipient user ID.' });
      return;
    }

    if (!data.callId || data.callId.trim() === '') {
      client.emit('error', { message: 'Invalid call ID.' });
      return;
    }

    const toSocketId = this.users.get(data.toUserId);

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
      client.emit('error', { message: 'You cannot call this user.' });
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
      client.emit('error', { message: 'You can only call friends.' });
      return;
    }

    const chat = await this.chatService.findOrCreateDirectChat(
      fromUser.id,
      data.toUserId,
    );

    await this.db.message.create({
      data: {
        type: 'announcement',
        content: `Call initiated - Call ID: ${data.callId}`,
        userId: fromUser.id,
        chatId: chat.id,
      },
    });

    if (toSocketId) {
      this.server.to(toSocketId).emit('incoming-call', {
        fromUserId: fromUser.id,
        fromUsername: fromUser.username,
        callId: data.callId,
        profilePicture: fromUser?.profile_picture?.url,
      });
    }

    this.logger.log(
      `Call initiated from user ${fromUser.id} to user ${data.toUserId} with callId ${data.callId}`,
    );
  }

  isUserConnected(userId: string): boolean {
    return this.users.has(userId);
  }

  private attachSocketRequestLogging(client: Socket, userId: string): void {
    client.onAny((eventName: string, ...args: unknown[]) => {
      const payload = this.formatSocketArgsForLog(args);
      this.logger.log(
        `[socket in] id=${client.id} userId=${userId} event=${eventName} payload=${payload}`,
      );
    });
  }

  private formatSocketArgsForLog(args: unknown[]): string {
    if (args.length === 0) {
      return '∅';
    }
    try {
      const raw = JSON.stringify(args);
      const max = 800;
      return raw.length > max ? `${raw.slice(0, max)}…` : raw;
    } catch {
      return '[unserializable]';
    }
  }
}
