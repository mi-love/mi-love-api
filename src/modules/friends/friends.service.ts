import { DbService } from '@/database/database.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { listFriendsDto } from './friends.dto';
import { PaginationUtils } from '@/common/services/pagination.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FriendsService {
  constructor(
    private db: DbService,
    private pagination: PaginationUtils,
  ) {}

  async userExists(userId: string) {
    const friendExists = await this.db.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!friendExists) {
      throw new BadRequestException({
        message: 'Friend Not Found',
      });
    }

    return friendExists;
  }

  async listFriends({
    userId,
    query,
  }: {
    userId: string;
    query: listFriendsDto;
  }) {
    const { limit, skip } = this.pagination.getPagination({
      limit: query.limit,
      page: query.page,
    });

    if (query?.filterBy === 'blocked') {
      const where: Prisma.blocked_usersWhereInput = {
        user: {
          id: userId,
          email: {
            contains: query.filterValue,
          },
          first_name: {
            contains: query.filterValue,
          },
          last_name: {
            contains: query.filterValue,
          },
          username: {
            contains: query.filterValue,
          },
        },
      };
      const all = await this.db.blocked_users.count({
        where,
      });
      const blockedUsers = await this.db.blocked_users.findMany({
        where,
        select: {
          blocked_user: {
            select: {
              email: true,
              id: true,
              username: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          created_at: query?.order === 'desc' ? 'desc' : 'asc',
        },
      });

      return {
        message: 'Blocked Users',
        data: blockedUsers.map((user) => user?.blocked_user),
        meta: this.pagination.getMeta({
          totalItems: all,
          limit,
          page: query.page,
        }),
      };
    }

    if (query?.filterBy === 'explore') {
      const where: Prisma.userWhereInput = {
        id: {
          not: userId,
        },
        my_friends: {
          none: {
            id: userId,
          },
        },
        // blocked_users: {}
      };
      const all = await this.db.user.count({ where });
      const friends = await this.db.user.findMany({
        where,
        include: {
          my_friends: {
            select: {
              email: true,
              id: true,
              first_name: true,
              last_name: true,
              username: true,
              profile_picture: {
                select: {
                  url: true,
                  provider: true,
                },
              },
            },
          },
          profile_picture: true,
        },
        skip,
        omit: {
          password: true,
          fcm_token: true,
        },
        take: limit,
        orderBy: {
          created_at: query?.order === 'desc' ? 'desc' : 'asc',
        },
      });

      return {
        message: 'Explore Users',
        data: friends,
        meta: this.pagination.getMeta({
          totalItems: all,
          limit,
          page: query.page,
        }),
      };
    }

    const where: Prisma.userWhereUniqueInput = {
      id: userId,
    };

    const all = await this.db.user.count({ where });
    const friends = await this.db.user.findUnique({
      where,
      include: {
        my_friends: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
            username: true,
            id: true,
            created_at: true,
            profile_picture: {
              select: {
                url: true,
                provider: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: {
            created_at: query?.order === 'desc' ? 'desc' : 'asc',
          },
        },
      },
    });

    return {
      message: 'Friends List',
      data: friends?.my_friends || [],
      meta: this.pagination.getMeta({
        totalItems: all,
        limit,
        page: query.page,
      }),
    };
  }

  async addFriend({ userId, friendId }: { userId: string; friendId: string }) {
    const friend = await this.userExists(friendId);

    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          my_friends: {
            connect: {
              id: friendId,
            },
          },
        },
      });

      const chatWithFriendExists = await tx.chat.findFirst({
        where: {
          participants: {
            some: {
              userId: {
                in: [userId, friendId],
              },
            },
          },
        },
      });

      if (chatWithFriendExists) {
        await tx.chat.update({
          where: {
            id: chatWithFriendExists.id,
          },
          data: {
            can_send_messages: true,
          },
        });
      } else {
        await tx.chat.create({
          data: {
            participants: {
              create: [
                {
                  user: {
                    connect: {
                      id: userId,
                    },
                  },
                },
                {
                  user: {
                    connect: {
                      id: friendId,
                    },
                  },
                },
              ],
            },
            messages: {
              create: {
                type: 'announcement',
                content: 'You are now friends',
              },
            },
            can_send_messages: true,
          },
        });
      }
    });

    return {
      message: 'Added to friends list',
      data: {
        id: friend.id,
      },
    };
  }

  async unFriend({ userId, friendId }: { userId: string; friendId: string }) {
    const friend = await this.userExists(friendId);
    await this.db.user.update({
      where: {
        id: userId,
      },
      data: {
        my_friends: {
          disconnect: {
            id: friendId,
          },
        },
      },
    });

    return {
      message: 'Removed from friends list',
      data: {
        id: friend.id,
      },
    };
  }

  async blockFriend({
    userId,
    friendId,
    reason,
  }: {
    userId: string;
    friendId: string;
    reason?: string;
  }) {
    await this.unFriend({ userId, friendId });
    await this.db.blocked_users.create({
      data: {
        blocked_user: {
          connect: {
            id: friendId,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
        reason,
      },
    });

    const chat = await this.db.chat.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [userId, friendId] },
          },
        },
      },
    });

    if (chat) {
      await this.db.chat.update({
        where: {
          id: chat.id,
        },
        data: {
          can_send_messages: false,
        },
      });
    }

    return {
      message: 'Blocked Users',
      data: {
        id: friendId,
      },
    };
  }

  async unblockFriend({
    userId,
    friendId,
  }: {
    userId: string;
    friendId: string;
  }) {
    const findBlockerId = await this.db.blocked_users.findFirst({
      where: {
        user: {
          id: userId,
        },
        blocked_user: {
          id: friendId,
        },
      },
    });
    if (!findBlockerId) {
      return {
        message: 'User not blocked',
      };
      //   throw new BadRequestException({
      //     message: 'User not blocked',
      //   });
    }
    await this.db.blocked_users.update({
      where: {
        id: findBlockerId.id,
      },
      data: {
        user: {
          disconnect: {
            id: userId,
          },
        },
      },
    });

    // Update chat based on friendship status
    const chat = await this.db.chat.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [userId, friendId] },
          },
        },
      },
    });

    if (chat) {
      const isFriend = await this.db.user.findFirst({
        where: {
          id: userId,
          my_friends: { some: { id: friendId } },
        },
      });

      await this.db.chat.update({
        where: {
          id: chat.id,
        },
        data: {
          can_send_messages: !!isFriend,
        },
      });
    }

    return {
      message: 'Unblocked Users',
      data: {
        id: friendId,
      },
    };
  }
}
