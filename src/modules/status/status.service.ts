import { DbService } from '@/database/database.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { createStatusDto, getStatusDto } from './status.dto';
import { PaginationUtils } from '@/common/services/pagination.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StatusService {
  constructor(
    private readonly db: DbService,
    private pagination: PaginationUtils,
  ) {}

  async createStatus(body: createStatusDto, userId: string) {
    if (!body?.content?.trim() && !body?.fileId) {
      throw new BadRequestException({
        message: 'Content or File is required or both',
      });
    }

    const checkFile = await this.db.file.findUnique({
      where: {
        id: body.fileId,
      },
    });

    if (!checkFile) {
      new BadRequestException({
        message: 'Invalid file included or file not uploaded correctly',
      });
    }

    const status = await this.db.status.create({
      data: {
        content: body?.content,
        file: {
          connect: {
            id: body.fileId,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return {
      message: 'Status created will dissapear after 24 hrs',
      data: status,
    };
  }

  async deleteStatus(statusId: string, userId: string) {
    const status = await this.db.status.findUnique({
      where: {
        id: statusId,
        userId,
      },
    });

    if (!status) {
      throw new BadRequestException({
        message: 'Status not found or anot authorized',
      });
    }

    await this.db.status.delete({
      where: {
        id: statusId,
        userId,
      },
    });

    return {
      message: 'Status deleted',
    };
  }

  async getStatuses(userId: string, query: getStatusDto) {
    const { limit, skip } = this.pagination.getPagination(query);
    const friends = await this.db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        my_friends: {
          select: {
            id: true,
          },
        },
      },
    });

    const friendIds = friends?.my_friends.map((friend) => friend.id) || [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: Prisma.statusWhereInput = {
      userId: { in: friendIds },
      created_at: { gte: twentyFourHoursAgo },
    };

    const statuses = await this.db.status.findMany({
      where,
      skip,
      take: limit,
    });

    const groupedStatuses = statuses.reduce((acc, status) => {
      if (!acc[status.userId]) {
        acc[status.userId] = [];
      }
      acc[status.userId].push(status);
      return acc;
    }, {});

    return {
      data: groupedStatuses,
      meta: this.pagination.getMeta({
        limit,
        page: query?.page || 1,
        totalItems: statuses.length,
      }),
    };
  }
}
