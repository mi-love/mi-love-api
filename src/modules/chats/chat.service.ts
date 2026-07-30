import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SendMessageDto } from './chat.dto';
import { DbService } from '@/database/database.service';
import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';
import { NotificationService } from '../notifications/notification.service';

const MESSAGE_FEE = 0.5;
const ALLOWED_REACTION_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);

const userPreviewSelect = {
  id: true,
  username: true,
  first_name: true,
  last_name: true,
  profile_picture: {
    select: { url: true },
  },
} as const;

@Injectable()
export class ChatService {
  constructor(
    private readonly db: DbService,
    private readonly paginationUtils: PaginationUtils,
    private readonly notificationService: NotificationService,
  ) {}

  private groupReactions(
    reactions: Array<{
      emoji: string;
      userId: string;
      user: { id: string; username: string };
    }>,
    currentUserId?: string,
  ) {
    const map = new Map<
      string,
      {
        emoji: string;
        count: number;
        users: Array<{ id: string; username: string }>;
        reactedByMe: boolean;
      }
    >();

    for (const reaction of reactions) {
      const existing = map.get(reaction.emoji) || {
        emoji: reaction.emoji,
        count: 0,
        users: [],
        reactedByMe: false,
      };
      existing.count += 1;
      existing.users.push({
        id: reaction.user.id,
        username: reaction.user.username,
      });
      if (currentUserId && reaction.userId === currentUserId) {
        existing.reactedByMe = true;
      }
      map.set(reaction.emoji, existing);
    }

    return Array.from(map.values());
  }

  private formatReplyTo(
    parent:
      | {
          id: string;
          type: string;
          content: string | null;
          userId: string | null;
          deleted: boolean;
          created_at: Date;
          user: {
            id: string;
            username: string;
            first_name: string;
            last_name: string;
            profile_picture: { url: string } | null;
          } | null;
          file: { url: string } | null;
        }
      | null
      | undefined,
  ) {
    if (!parent) return null;
    if (parent.deleted) {
      return {
        id: parent.id,
        type: parent.type,
        content: '',
        deleted: true,
      };
    }
    return {
      id: parent.id,
      type: parent.type,
      content: parent.content ?? '',
      userId: parent.userId,
      created_at: parent.created_at,
      user: parent.user,
      file: parent.file ? { url: parent.file.url } : null,
    };
  }

  private formatSocketReplyTo(
    parent: {
      id: string;
      type: string;
      content: string | null;
      userId: string | null;
      deleted: boolean;
      created_at: Date;
      user: { id: string; username: string } | null;
      file: { url: string } | null;
    } | null,
  ) {
    if (!parent) return null;
    if (parent.deleted) {
      return {
        id: parent.id,
        type: parent.type,
        content: '',
        deleted: true,
      };
    }
    return {
      id: parent.id,
      type: parent.type,
      content: parent.content ?? '',
      fromUserId: parent.userId,
      fromUsername: parent.user?.username,
      file: parent.file ? { url: parent.file.url } : null,
      created_at: parent.created_at,
    };
  }

  private async validateReplyTarget(chatId: string, replyToMessageId: string) {
    const parent = await this.db.message.findUnique({
      where: { id: replyToMessageId },
      include: {
        user: { select: userPreviewSelect },
        file: { select: { url: true } },
      },
    });

    if (!parent) {
      throw new BadRequestException({ message: 'Parent message not found' });
    }
    if (parent.chatId !== chatId) {
      throw new BadRequestException({
        message: 'Cannot reply to a message from another chat',
      });
    }
    if (parent.deleted) {
      throw new BadRequestException({
        message: 'Cannot reply to a deleted message',
      });
    }
    if (parent.type === 'announcement') {
      throw new ForbiddenException({
        message: 'Cannot reply to system/announcement messages',
      });
    }

    return parent;
  }

  async assertChatParticipant(userId: string, chatId: string) {
    const chat = await this.db.chat.findFirst({
      where: {
        id: chatId,
        participants: { some: { userId } },
      },
      include: { participants: true },
    });
    if (!chat) {
      throw new ForbiddenException({
        message: 'You are not a participant in this chat.',
      });
    }
    return chat;
  }

  async findOrCreateDirectChat(fromUserId: string, toUserId: string) {
    const existing = await this.db.chat.findFirst({
      where: {
        type: 'direct',
        AND: [
          { participants: { some: { userId: fromUserId } } },
          { participants: { some: { userId: toUserId } } },
        ],
      },
      include: { participants: true },
    });

    // Prefer a true 1:1 DM (exactly two participants)
    if (existing && existing.participants.length === 2) {
      return existing;
    }

    return this.db.chat.create({
      data: {
        type: 'direct',
        participants: {
          create: [
            { userId: fromUserId, role: 'member' },
            { userId: toUserId, role: 'member' },
          ],
        },
      },
      include: { participants: true },
    });
  }

  private formatChat(chat: {
    id: string;
    type: string;
    name: string | null;
    can_send_messages: boolean;
    created_at: Date;
    updated_at: Date;
    avatar?: { url: string } | null;
    participants: Array<{
      role?: string;
      user: {
        id: string;
        username: string;
        first_name: string;
        last_name: string;
        profile_picture: { url: string } | null;
      };
    }>;
    messages?: unknown[];
  }) {
    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      avatar: chat.avatar ? { url: chat.avatar.url } : null,
      avatar_url: chat.avatar?.url ?? null,
      memberCount: chat.participants.length,
      member_count: chat.participants.length,
      can_send_messages: chat.can_send_messages,
      created_at: chat.created_at,
      updated_at: chat.updated_at,
      participants: chat.participants.map((p) => ({
        role: p.role || 'member',
        user: p.user,
      })),
      messages: chat.messages || [],
      last_message: Array.isArray(chat.messages) ? chat.messages[0] : undefined,
    };
  }

  private async loadChatForResponse(chatId: string) {
    return this.db.chat.findUnique({
      where: { id: chatId },
      include: {
        avatar: { select: { url: true } },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                first_name: true,
                last_name: true,
                profile_picture: { select: { url: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            user: { select: { id: true, username: true } },
            file: true,
          },
        },
      },
    });
  }

  private async assertFriend(userId: string, otherUserId: string) {
    const isFriend = await this.db.user.findFirst({
      where: {
        id: userId,
        OR: [
          { friends: { some: { id: otherUserId } } },
          { my_friends: { some: { id: otherUserId } } },
        ],
      },
      select: { id: true },
    });
    return Boolean(isFriend);
  }

  async createGroup(
    userId: string,
    body: { name: string; memberIds: string[]; avatarFileId?: string },
  ) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException({ message: 'Group name is required' });
    }

    const uniqueMemberIds = [...new Set(body.memberIds.filter(Boolean))];
    const memberIds = uniqueMemberIds.filter((id) => id !== userId);

    if (!memberIds.length) {
      throw new BadRequestException({
        message: 'Add at least one other member',
      });
    }

    const users = await this.db.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    if (users.length !== memberIds.length) {
      throw new BadRequestException({
        message: 'One or more members were not found',
      });
    }

    for (const memberId of memberIds) {
      const ok = await this.assertFriend(userId, memberId);
      if (!ok) {
        throw new ForbiddenException({
          message: 'You can only add friends to a group',
        });
      }
    }

    if (body.avatarFileId) {
      const file = await this.db.file.findUnique({
        where: { id: body.avatarFileId },
        select: { id: true },
      });
      if (!file) {
        throw new BadRequestException({ message: 'Invalid avatarFileId' });
      }
    }

    const chat = await this.db.chat.create({
      data: {
        type: 'group',
        name,
        avatarId: body.avatarFileId || null,
        participants: {
          create: [
            { userId, role: 'owner' },
            ...memberIds.map((id) => ({
              userId: id,
              role: 'member' as const,
            })),
          ],
        },
        messages: {
          create: {
            type: 'announcement',
            content: `${name} was created`,
            userId: null,
          },
        },
      },
    });

    const full = await this.loadChatForResponse(chat.id);
    return {
      message: 'Group created',
      data: this.formatChat(full!),
    };
  }

  async addGroupMembers(
    userId: string,
    chatId: string,
    memberIds: string[],
  ) {
    const chat = await this.db.chat.findFirst({
      where: {
        id: chatId,
        type: 'group',
        participants: { some: { userId } },
      },
      include: { participants: true },
    });

    if (!chat) {
      throw new NotFoundException({ message: 'Group chat not found' });
    }

    const actor = chat.participants.find((p) => p.userId === userId);
    if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
      throw new ForbiddenException({
        message: 'Only group owners or admins can add members',
      });
    }

    const existing = new Set(chat.participants.map((p) => p.userId));
    const toAdd = [...new Set(memberIds.filter(Boolean))].filter(
      (id) => id !== userId && !existing.has(id),
    );

    if (!toAdd.length) {
      throw new BadRequestException({
        message: 'No new members to add',
      });
    }

    const users = await this.db.user.findMany({
      where: { id: { in: toAdd } },
      select: { id: true },
    });
    if (users.length !== toAdd.length) {
      throw new BadRequestException({
        message: 'One or more members were not found',
      });
    }

    for (const memberId of toAdd) {
      const ok = await this.assertFriend(userId, memberId);
      if (!ok) {
        throw new ForbiddenException({
          message: 'You can only add friends to a group',
        });
      }
    }

    await this.db.$transaction([
      this.db.participant.createMany({
        data: toAdd.map((id) => ({
          chatId,
          userId: id,
          role: 'member',
        })),
      }),
      this.db.message.create({
        data: {
          chatId,
          type: 'announcement',
          content: `${toAdd.length} member(s) joined the group`,
          userId: null,
        },
      }),
      this.db.chat.update({
        where: { id: chatId },
        data: { updated_at: new Date() },
      }),
    ]);

    const full = await this.loadChatForResponse(chatId);
    return {
      message: 'Members added',
      data: this.formatChat(full!),
    };
  }

  async getChatById(userId: string, chatId: string) {
    await this.assertChatParticipant(userId, chatId);
    const full = await this.loadChatForResponse(chatId);
    if (!full) {
      throw new NotFoundException({ message: 'Chat not found' });
    }
    return { data: this.formatChat(full) };
  }

  async sendMessage(userId: string, body: SendMessageDto) {
    const { message, fileId, replyToMessageId, chatId, toUserId } = body;

    if (!message?.trim() && !fileId) {
      throw new BadRequestException({
        message: 'No message or fileId provided',
      });
    }

    const fromUser = await this.db.user.findUnique({
      where: { id: userId },
      include: { profile_picture: true, wallet: true },
    });
    if (!fromUser) {
      throw new NotFoundException({ message: 'User not found' });
    }

    let chat =
      chatId != null
        ? await this.assertChatParticipant(userId, chatId)
        : null;

    let recipientId = toUserId;
    if (!chat) {
      if (!recipientId) {
        throw new BadRequestException({
          message: 'chatId or toUserId is required',
        });
      }
      if (recipientId === userId) {
        throw new BadRequestException({
          message: 'Cannot message yourself',
        });
      }

      const toUser = await this.db.user.findUnique({ where: { id: recipientId } });
      if (!toUser) {
        throw new NotFoundException({ message: 'Recipient user not found' });
      }

      const isBlocked = await this.db.blocked_users.findFirst({
        where: {
          OR: [
            { userId, blockedUserId: recipientId },
            { userId: recipientId, blockedUserId: userId },
          ],
        },
      });
      if (isBlocked) {
        throw new ForbiddenException({ message: 'You cannot message this user.' });
      }

      const isFriend = await this.db.user.findFirst({
        where: {
          id: userId,
          OR: [
            { friends: { some: { id: recipientId } } },
            { my_friends: { some: { id: recipientId } } },
          ],
        },
      });
      if (!isFriend) {
        throw new ForbiddenException({ message: 'You can only message friends.' });
      }

      chat = await this.findOrCreateDirectChat(userId, recipientId);
    } else if (chat.type === 'direct') {
      const other = chat.participants.find((p) => p.userId !== userId);
      recipientId = other?.userId;
    } else {
      // Group chat — broadcast to room; no single DM recipient
      recipientId = undefined;
    }

    if (!chat.can_send_messages) {
      throw new ForbiddenException({
        message: 'Messaging is disabled in this chat.',
      });
    }

    if (replyToMessageId) {
      await this.validateReplyTarget(chat.id, replyToMessageId);
    }

    if (fileId) {
      const file = await this.db.file.findUnique({ where: { id: fileId } });
      if (!file) {
        throw new BadRequestException({ message: 'Invalid fileId' });
      }
    }

    const messageType = fileId ? 'file' : 'text';
    const savedMessage = await this.db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { id: fromUser.walletId },
      });
      if (Number(wallet?.balance) < MESSAGE_FEE) {
        throw new BadRequestException({
          message: 'Insufficient balance to send message.',
        });
      }

      const created = await tx.message.create({
        data: {
          type: messageType,
          content: message?.trim() || null,
          fileId: fileId || null,
          userId,
          chatId: chat.id,
          replyToMessageId: replyToMessageId || null,
        },
        include: {
          file: true,
          user: { select: userPreviewSelect },
          replyTo: {
            include: {
              user: { select: userPreviewSelect },
              file: { select: { url: true } },
            },
          },
          reactions: {
            include: {
              user: { select: { id: true, username: true } },
            },
          },
        },
      });

      await tx.wallet.update({
        where: { id: fromUser.walletId },
        data: { balance: { decrement: MESSAGE_FEE } },
      });

      await tx.chat.update({
        where: { id: chat.id },
        data: { updated_at: new Date() },
      });

      return created;
    });

    const truncateText = (text: string, maxLength: number) =>
      text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
    const notifBody = message?.trim()
      ? truncateText(message.trim(), 100)
      : 'Sent a file';
    const notifImage =
      savedMessage.file?.url || fromUser.profile_picture?.url || undefined;

    const otherParticipantIds = chat.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    if (chat.type === 'group') {
      for (const uid of otherParticipantIds) {
        this.notificationService
          .sendNotification({
            title: `${fromUser.username} in ${chat.name || 'group'}`,
            message: notifBody,
            type: 'message',
            userId: uid,
            image: notifImage,
          })
          .catch(() => undefined);
      }
    } else if (recipientId) {
      this.notificationService
        .sendNotification({
          title: `New message from ${fromUser.username}`,
          message: notifBody,
          type: 'message',
          userId: recipientId,
          image: notifImage,
        })
        .catch(() => undefined);
    }

    const basePayload = this.toSocketPayload(savedMessage, fromUser.username);

    return {
      data: {
        id: savedMessage.id,
        chatId: savedMessage.chatId,
        type: savedMessage.type,
        content: savedMessage.content,
        userId: savedMessage.userId,
        fileId: savedMessage.fileId,
        file: savedMessage.file,
        replyToMessageId: savedMessage.replyToMessageId,
        replyTo: this.formatReplyTo(savedMessage.replyTo),
        reactions: this.groupReactions(savedMessage.reactions, userId),
        created_at: savedMessage.created_at,
        updated_at: savedMessage.updated_at,
        user: savedMessage.user,
      },
      recipientId: chat.type === 'direct' ? recipientId : undefined,
      isGroup: chat.type === 'group',
      chatId: chat.id,
      participantUserIds: chat.participants.map((p) => p.userId),
      socketPayload:
        chat.type === 'group'
          ? { ...basePayload, chatId: chat.id }
          : basePayload,
    };
  }

  toSocketPayload(
    savedMessage: {
      id: string;
      type: string;
      content: string | null;
      userId: string | null;
      created_at: Date;
      replyToMessageId: string | null;
      file: { url: string; created_at?: Date } | null;
      replyTo: {
        id: string;
        type: string;
        content: string | null;
        userId: string | null;
        deleted: boolean;
        created_at: Date;
        user: { id: string; username: string } | null;
        file: { url: string } | null;
      } | null;
    },
    fromUsername: string,
  ) {
    return {
      messageId: savedMessage.id,
      fromUserId: savedMessage.userId,
      fromUsername,
      message: savedMessage.content,
      content: savedMessage.content,
      type: savedMessage.type,
      file: savedMessage.file
        ? { url: savedMessage.file.url, created_at: savedMessage.file.created_at }
        : null,
      created_at: savedMessage.created_at,
      replyToMessageId: savedMessage.replyToMessageId,
      replyTo: this.formatSocketReplyTo(savedMessage.replyTo),
    };
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
        avatar: { select: { url: true } },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                first_name: true,
                last_name: true,
                profile_picture: { select: { url: true } },
              },
            },
          },
        },
        messages: {
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
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
      data: chats.map((c) => this.formatChat(c)),
      meta: this.paginationUtils.getMeta({ totalItems: total, ...pagination }),
    };
  }

  async getMessages(
    userId: string,
    chatId: string,
    pagination: { page: string; limit: string },
  ) {
    await this.assertChatParticipant(userId, chatId);

    const { skip, limit } = this.paginationUtils.getPagination(pagination);

    const messages = await this.db.message.findMany({
      where: { chatId },
      include: {
        user: { select: userPreviewSelect },
        file: true,
        replyTo: {
          include: {
            user: { select: userPreviewSelect },
            file: { select: { url: true } },
          },
        },
        reactions: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });

    const total = await this.db.message.count({
      where: { chatId },
    });

    return {
      data: messages.map((msg) => ({
        ...msg,
        replyTo: this.formatReplyTo(msg.replyTo),
        reactions: this.groupReactions(msg.reactions, userId),
      })),
      meta: this.paginationUtils.getMeta({ totalItems: total, ...pagination }),
    };
  }

  async addOrUpdateReaction(
    userId: string,
    messageId: string,
    emoji: string,
  ) {
    if (!ALLOWED_REACTION_EMOJIS.has(emoji)) {
      throw new BadRequestException({
        message: `Invalid emoji. Allowed: ${[...ALLOWED_REACTION_EMOJIS].join(' ')}`,
      });
    }

    const message = await this.db.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { participants: true } } },
    });

    if (!message || message.deleted) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    if (message.type === 'announcement') {
      throw new ForbiddenException({
        message: 'Cannot react to system/announcement messages',
      });
    }

    const isParticipant = message.chat.participants.some(
      (p) => p.userId === userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException({
        message: 'You are not a participant in this chat.',
      });
    }

    await this.db.message_reaction.upsert({
      where: {
        messageId_userId: { messageId, userId },
      },
      create: { messageId, userId, emoji },
      update: { emoji },
    });

    const reactions = await this.getGroupedReactions(messageId, userId);
    return {
      data: { messageId, reactions },
      chatId: message.chatId,
      participantUserIds: message.chat.participants.map((p) => p.userId),
    };
  }

  async removeReaction(userId: string, messageId: string) {
    const message = await this.db.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { participants: true } } },
    });

    if (!message || message.deleted) {
      throw new NotFoundException({ message: 'Message not found' });
    }

    const isParticipant = message.chat.participants.some(
      (p) => p.userId === userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException({
        message: 'You are not a participant in this chat.',
      });
    }

    await this.db.message_reaction.deleteMany({
      where: { messageId, userId },
    });

    const reactions = await this.getGroupedReactions(messageId, userId);
    return {
      data: { messageId, reactions },
      chatId: message.chatId,
      participantUserIds: message.chat.participants.map((p) => p.userId),
    };
  }

  async getGroupedReactions(messageId: string, currentUserId?: string) {
    const reactions = await this.db.message_reaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
    return this.groupReactions(reactions, currentUserId);
  }
}
