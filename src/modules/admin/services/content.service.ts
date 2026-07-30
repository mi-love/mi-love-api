import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  DeleteContentDto,
  ListAdminCommentsQueryDto,
  ListAdminPostsQueryDto,
} from '../dtos/content-gifts.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminContentService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async listPosts(query: ListAdminPostsQueryDto, adminId: string) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.postWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.visibility) where.visibility = query.visibility;
    if (query.search) {
      where.content = { contains: query.search, mode: 'insensitive' };
    }

    const [posts, total] = await Promise.all([
      this.db.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          files: { select: { id: true, url: true, type: true } },
          _count: {
            select: {
              likes: true,
              comments: { where: { deleted_at: null } },
            },
          },
        },
      }),
      this.db.post.count({ where }),
    ]);

    this.logger.logAdminAction(adminId, 'LIST_POSTS', 'post', undefined, {
      page,
      limit,
    });

    return {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getPost(postId: string, adminId: string) {
    const post = await this.db.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            first_name: true,
            last_name: true,
            email: true,
            account_status: true,
          },
        },
        files: true,
        _count: {
          select: {
            likes: true,
            comments: { where: { deleted_at: null } },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException({ message: 'Post not found' });
    }

    this.logger.logAdminAction(adminId, 'GET_POST', 'post', postId);
    return { data: post };
  }

  async deletePost(postId: string, data: DeleteContentDto, adminId: string) {
    const post = await this.db.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException({ message: 'Post not found' });
    }

    await this.db.post.delete({ where: { id: postId } });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'DELETE_POST',
        resource: 'post',
        resource_id: postId,
        metadata: { reason: data.reason, userId: post.userId },
      },
    });
    this.logger.logAdminAction(adminId, 'DELETE_POST', 'post', postId, data);

    return { message: 'Post deleted' };
  }

  async listComments(query: ListAdminCommentsQueryDto, adminId: string) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.commentWhereInput = {};
    if (query.postId) where.postId = query.postId;
    if (query.userId) where.userId = query.userId;
    if (!query.includeDeleted) where.deleted_at = null;

    const [comments, total] = await Promise.all([
      this.db.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          post: {
            select: { id: true, content: true, userId: true },
          },
        },
      }),
      this.db.comment.count({ where }),
    ]);

    return {
      data: comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async deleteComment(
    commentId: string,
    data: DeleteContentDto,
    adminId: string,
  ) {
    const comment = await this.db.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deleted_at) {
      throw new NotFoundException({ message: 'Comment not found' });
    }

    await this.db.comment.update({
      where: { id: commentId },
      data: { deleted_at: new Date(), content: '' },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'DELETE_COMMENT',
        resource: 'comment',
        resource_id: commentId,
        metadata: {
          reason: data.reason,
          postId: comment.postId,
          userId: comment.userId,
        },
      },
    });
    this.logger.logAdminAction(
      adminId,
      'DELETE_COMMENT',
      'comment',
      commentId,
      data,
    );

    return { message: 'Comment deleted' };
  }
}
