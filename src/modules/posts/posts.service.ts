import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '@/database/database.service';
import { createCommentDto, createPostDto, getPostsDto, updatePostDto } from './posts.dto';
import { Prisma } from '@prisma/client';
import { UserWithoutPassword } from '@/common/types/db';
import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';
import { NotificationService } from '../notifications/notification.service';

const commentUserSelect = {
  id: true,
  username: true,
  first_name: true,
  last_name: true,
  profile_picture: {
    select: { url: true },
  },
} as const;

@Injectable()
export class PostsService {
  constructor(
    private db: DbService,
    private paginationUtils: PaginationUtils,
    private notificationService: NotificationService,
  ) {}

  private async canViewPost(post: { userId: string; visibility: string }, viewerId: string) {
    if (post.visibility === 'public' || post.userId === viewerId) {
      return true;
    }

    const isFriend = await this.db.user.findFirst({
      where: {
        id: viewerId,
        OR: [
          { friends: { some: { id: post.userId } } },
          { my_friends: { some: { id: post.userId } } },
        ],
      },
      select: { id: true },
    });

    return Boolean(isFriend);
  }

  private async assertCanViewPost(postId: string, viewerId: string) {
    const post = await this.db.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, visibility: true },
    });
    if (!post) {
      throw new NotFoundException({ message: 'Post not found' });
    }
    const allowed = await this.canViewPost(post, viewerId);
    if (!allowed) {
      throw new ForbiddenException({ message: 'You cannot view this post' });
    }
    return post;
  }

  async updatePost({
    body,
    userId,
    postId,
  }: {
    body: updatePostDto;
    userId: string;
    postId: string;
  }) {
    const checkUser = await this.db.post.findUnique({
      where: {
        id: postId,
        userId,
      },
    });

    if (!checkUser) {
      throw new NotFoundException({
        message: 'Post not found',
      });
    }

    await this.db.post.update({
      where: {
        id: postId,
        userId,
      },
      data: {
        content: body?.content,
        visibility: body?.visibility,
      },
    });

    return {
      message: 'Post updated successfully',
    };
  }

  async getAllPosts({
    query,
    user,
  }: {
    query: getPostsDto;
    user: UserWithoutPassword;
  }) {
    const { filterValue, filterBy, ...queryParams } = query;
    const { skip, limit } = this.paginationUtils.getPagination(queryParams);

    const friendIds = (
      await this.db.user.findUnique({
        where: { id: user.id },
        select: {
          friends: { select: { id: true } },
          my_friends: { select: { id: true } },
        },
      })
    );
    const visibleAuthorIds = new Set<string>([
      user.id,
      ...(friendIds?.friends.map((f) => f.id) || []),
      ...(friendIds?.my_friends.map((f) => f.id) || []),
    ]);

    const where: Prisma.postWhereInput = {
      content: {
        contains: filterValue,
      },
      likes:
        filterBy == 'liked'
          ? {
              some: {
                id: user.id,
              },
            }
          : {},
      userId: filterBy == 'my' ? user.id : {},
      OR: [
        { visibility: 'public' },
        { userId: { in: [...visibleAuthorIds] } },
      ],
    };

    const allPosts = await this.db.post.count({
      where,
    });

    const posts = await this.db.post.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        user: {
          select: {
            first_name: true,
            id: true,
            email: true,
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
        files: {
          select: {
            url: true,
            provider: true,
          },
          take: 5,
          orderBy: {
            created_at: 'desc',
          },
        },
        _count: {
          select: {
            files: true,
            likes: true,
            comments: { where: { deleted_at: null } },
          },
        },
      },
      orderBy: {
        created_at: query.order == 'desc' ? 'desc' : 'asc',
      },
    });
    return {
      posts,
      meta: this.paginationUtils.getMeta({
        totalItems: allPosts,
        page: queryParams.page,
        limit: queryParams.limit,
      }),
    };
  }

  async getPostById(id: string, viewerId: string) {
    const post = await this.db.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            username: true,
            id: true,
            profile_picture: true,
          },
        },
        files: {
          select: {
            provider: true,
            url: true,
          },
        },
        _count: {
          select: {
            files: true,
            likes: true,
            comments: { where: { deleted_at: null } },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
      });
    }

    const allowed = await this.canViewPost(post, viewerId);
    if (!allowed) {
      throw new ForbiddenException({ message: 'You cannot view this post' });
    }

    return {
      data: post,
    };
  }

  async deletePost(id: string, userId: string) {
    const post = await this.db.post.findUnique({
      where: {
        id,
        userId,
      },
    });
    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
      });
    }
    await this.db.post.delete({
      where: { id, userId },
    });

    return {
      message: 'Post deleted',
    };
  }

  async createPost({
    post,
    user,
  }: {
    post: createPostDto;
    user: UserWithoutPassword;
  }) {
    const post_ = await this.db.post.create({
      data: {
        content: post.content,
        visibility: post.visibility,
        user: {
          connect: {
            id: user.id,
          },
        },
        files: {
          connect: (post.files || []).map((file) => ({ id: file })),
        },
      },
      select: {
        id: true,
      },
    });

    return {
      message: 'Post created successfully',
      data: post_,
    };
  }

  async likePost({ postId, userId }: { postId: string; userId: string }) {
    await this.assertCanViewPost(postId, userId);

    await this.db.post.update({
      where: { id: postId },
      data: {
        likes: {
          connect: { id: userId },
        },
      },
    });

    return {
      message: 'Post liked successfully',
    };
  }

  async unlikePost({ postId, userId }: { postId: string; userId: string }) {
    await this.assertCanViewPost(postId, userId);

    await this.db.post.update({
      where: { id: postId },
      data: {
        likes: {
          disconnect: { id: userId },
        },
      },
    });

    return {
      message: 'Post unliked successfully',
    };
  }

  async getPostLikes(postId: string, query: PaginationParams, viewerId: string) {
    await this.assertCanViewPost(postId, viewerId);
    const { skip, limit } = this.paginationUtils.getPagination(query);

    const allLikes = await this.db.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    if (!allLikes) {
      throw new NotFoundException({
        message: 'Post not found',
      });
    }

    const likes = await this.db.post.findUnique({
      where: { id: postId },
      include: {
        likes: {
          select: {
            id: true,
            username: true,
            last_name: true,
            bio: true,
            profile_picture: {
              select: {
                url: true,
                provider: true,
              },
            },
          },
          skip,
          take: limit,
        },
      },
    });

    return {
      data: likes?.likes,
      meta: this.paginationUtils.getMeta({
        totalItems: allLikes?._count?.likes || 0,
        page: query.page,
        limit: query.limit,
      }),
    };
  }

  async getPostComments(
    postId: string,
    viewerId: string,
    query: PaginationParams & { order?: 'asc' | 'desc' },
  ) {
    await this.assertCanViewPost(postId, viewerId);
    const { skip, limit } = this.paginationUtils.getPagination(query);
    const order = query.order === 'desc' ? 'desc' : 'asc';

    const where: Prisma.commentWhereInput = {
      postId,
      deleted_at: null,
      parentId: null,
    };

    const totalItems = await this.db.comment.count({ where });
    const comments = await this.db.comment.findMany({
      where,
      skip,
      take: Math.min(limit, 50),
      orderBy: { created_at: order },
      include: {
        user: { select: commentUserSelect },
      },
    });

    return {
      data: comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        content: c.content,
        userId: c.userId,
        parentId: c.parentId,
        created_at: c.created_at,
        updated_at: c.updated_at,
        user: c.user,
      })),
      meta: this.paginationUtils.getMeta({
        totalItems,
        page: query.page,
        limit: Math.min(Number(query.limit) || 20, 50),
      }),
    };
  }

  async createComment({
    postId,
    userId,
    body,
    username,
  }: {
    postId: string;
    userId: string;
    body: createCommentDto;
    username: string;
  }) {
    const content = body.content?.trim();
    if (!content) {
      throw new BadRequestException({ message: 'Content is required' });
    }
    if (content.length > 2000) {
      throw new BadRequestException({
        message: 'Content must be 2000 characters or less',
      });
    }

    const post = await this.assertCanViewPost(postId, userId);

    if (body.parentId) {
      const parent = await this.db.comment.findFirst({
        where: {
          id: body.parentId,
          postId,
          deleted_at: null,
        },
      });
      if (!parent) {
        throw new BadRequestException({
          message: 'Parent comment not found on this post',
        });
      }
      if (parent.parentId) {
        throw new BadRequestException({
          message: 'Only one level of replies is allowed',
        });
      }
    }

    const comment = await this.db.comment.create({
      data: {
        content,
        postId,
        userId,
        parentId: body.parentId || null,
      },
      include: {
        user: { select: commentUserSelect },
      },
    });

    if (post.userId !== userId) {
      this.notificationService
        .sendNotification({
          title: 'New comment',
          message: `@${username} commented on your post`,
          type: 'comment',
          userId: post.userId,
          metadata: {
            postId,
            commentId: comment.id,
            actorUserId: userId,
          },
        })
        .catch(() => undefined);
    }

    return {
      message: 'Comment added',
      data: {
        id: comment.id,
        postId: comment.postId,
        content: comment.content,
        userId: comment.userId,
        parentId: comment.parentId,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        user: comment.user,
      },
    };
  }

  async deleteComment({
    postId,
    commentId,
    userId,
  }: {
    postId: string;
    commentId: string;
    userId: string;
  }) {
    const post = await this.db.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });
    if (!post) {
      throw new NotFoundException({ message: 'Post not found' });
    }

    const comment = await this.db.comment.findFirst({
      where: {
        id: commentId,
        postId,
        deleted_at: null,
      },
    });
    if (!comment) {
      throw new NotFoundException({ message: 'Comment not found' });
    }

    const isCommentAuthor = comment.userId === userId;
    const isPostAuthor = post.userId === userId;
    if (!isCommentAuthor && !isPostAuthor) {
      throw new ForbiddenException({
        message: 'You cannot delete this comment',
      });
    }

    await this.db.comment.update({
      where: { id: commentId },
      data: {
        deleted_at: new Date(),
        content: '',
      },
    });

    return {
      message: 'Comment deleted',
    };
  }
}
