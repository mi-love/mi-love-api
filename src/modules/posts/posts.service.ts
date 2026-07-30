import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '@/database/database.service';
import {
  createCommentDto,
  createPostDto,
  getPostsDto,
  getVideoFeedDto,
  updatePostDto,
} from './posts.dto';
import { Prisma, file_type } from '@prisma/client';
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

const postAuthorSelect = {
  id: true,
  first_name: true,
  last_name: true,
  username: true,
  email: true,
  profile_picture: {
    select: {
      url: true,
      provider: true,
    },
  },
} as const;

const postFileSelect = {
  id: true,
  url: true,
  provider: true,
  type: true,
} as const;

function fileThumbnailUrl(url: string, type: file_type): string | null {
  if (type !== file_type.video) return null;
  if (url.includes('/video/upload/')) {
    return url
      .replace('/video/upload/', '/video/upload/so_0/')
      .replace(/\.(mp4|mov|webm|m4v|avi)(\?.*)?$/i, '.jpg$2');
  }
  return null;
}

function mapPostFiles(
  files: Array<{
    id: string;
    url: string;
    provider: string;
    type: file_type;
  }>,
) {
  return files.map((f) => ({
    id: f.id,
    url: f.url,
    provider: f.provider,
    type: f.type,
    thumbnailUrl: fileThumbnailUrl(f.url, f.type),
  }));
}

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
        user: { select: postAuthorSelect },
        files: {
          select: postFileSelect,
          take: 5,
          orderBy: { created_at: 'desc' },
        },
        likes: {
          where: { id: user.id },
          select: { id: true },
          take: 1,
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
      posts: posts.map((p) => {
        const { likes, files, ...rest } = p;
        return {
          ...rest,
          files: mapPostFiles(files),
          likedByMe: likes.length > 0,
        };
      }),
      meta: this.paginationUtils.getMeta({
        totalItems: allPosts,
        page: queryParams.page,
        limit: queryParams.limit,
      }),
    };
  }

  /**
   * TikTok-style vertical video feed: posts that include at least one video.
   * Newest first; supports page or cursor infinite scroll.
   */
  async getVideoFeed({
    query,
    user,
  }: {
    query: getVideoFeedDto;
    user: UserWithoutPassword;
  }) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 20);

    const friendIds = await this.db.user.findUnique({
      where: { id: user.id },
      select: {
        friends: { select: { id: true } },
        my_friends: { select: { id: true } },
      },
    });
    const visibleAuthorIds = new Set<string>([
      user.id,
      ...(friendIds?.friends.map((f) => f.id) || []),
      ...(friendIds?.my_friends.map((f) => f.id) || []),
    ]);

    const andFilters: Prisma.postWhereInput[] = [
      {
        OR: [
          { visibility: 'public' },
          { userId: { in: [...visibleAuthorIds] } },
        ],
      },
      {
        files: {
          some: { type: file_type.video },
        },
      },
    ];

    if (query.cursor) {
      const cursorPost = await this.db.post.findUnique({
        where: { id: query.cursor },
        select: { created_at: true },
      });
      if (cursorPost) {
        andFilters.push({ created_at: { lt: cursorPost.created_at } });
      }
    }

    const where: Prisma.postWhereInput = { AND: andFilters };

    const totalItems = await this.db.post.count({ where });
    const skip = query.cursor ? 0 : (page - 1) * limit;

    const posts = await this.db.post.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: postAuthorSelect },
        files: {
          where: { type: file_type.video },
          select: postFileSelect,
          orderBy: { created_at: 'desc' },
        },
        likes: {
          where: { id: user.id },
          select: { id: true },
          take: 1,
        },
        _count: {
          select: {
            likes: true,
            comments: { where: { deleted_at: null } },
            files: true,
          },
        },
      },
    });

    const data = posts.map((p) => {
      const { likes, files, ...rest } = p;
      const mappedFiles = mapPostFiles(files);
      return {
        ...rest,
        files: mappedFiles,
        video: mappedFiles[0] || null,
        likedByMe: likes.length > 0,
      };
    });

    const nextCursor =
      data.length === limit ? data[data.length - 1]?.id : null;

    return {
      data,
      meta: {
        totalPages: Math.ceil(totalItems / limit) || 1,
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        nextCursor,
      },
    };
  }

  async getPostById(id: string, viewerId: string) {
    const post = await this.db.post.findUnique({
      where: { id },
      include: {
        user: { select: postAuthorSelect },
        files: {
          select: postFileSelect,
        },
        likes: {
          where: { id: viewerId },
          select: { id: true },
          take: 1,
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

    const { likes, files, ...rest } = post;
    return {
      data: {
        ...rest,
        files: mapPostFiles(files),
        likedByMe: likes.length > 0,
      },
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
    const fileIds = post.files || [];
    const content = (post.content || '').trim();

    if (!content && !fileIds.length) {
      throw new BadRequestException({
        message: 'Post must have content or at least one media file',
      });
    }

    if (fileIds.length) {
      const existing = await this.db.file.findMany({
        where: { id: { in: fileIds } },
        select: { id: true, type: true },
      });
      if (existing.length !== fileIds.length) {
        throw new BadRequestException({
          message: 'One or more media files were not found. Upload first via POST /upload',
        });
      }
    }

    const created = await this.db.post.create({
      data: {
        content: content || '',
        visibility: post.visibility || 'public',
        user: {
          connect: {
            id: user.id,
          },
        },
        files: {
          connect: fileIds.map((file) => ({ id: file })),
        },
      },
      include: {
        user: { select: postAuthorSelect },
        files: { select: postFileSelect },
        _count: {
          select: {
            files: true,
            likes: true,
            comments: { where: { deleted_at: null } },
          },
        },
      },
    });

    return {
      message: 'Post created successfully',
      data: {
        ...created,
        files: mapPostFiles(created.files),
        likedByMe: false,
      },
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

    const page = Number(query.page) || 1;
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;
    const order = query.order === 'desc' ? 'desc' : 'asc';

    // Flat list of non-deleted comments (incl. one-level replies via parentId)
    const where: Prisma.commentWhereInput = {
      postId,
      deleted_at: null,
    };

    const totalItems = await this.db.comment.count({ where });
    const comments = await this.db.comment.findMany({
      where,
      skip,
      take: limit,
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
      meta: {
        totalPages: Math.ceil(totalItems / limit) || 1,
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
      },
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
    username?: string;
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

    let actorUsername = username;
    if (!actorUsername) {
      const actor = await this.db.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      actorUsername = actor?.username || 'someone';
    }

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
          message: `@${actorUsername} commented on your post`,
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

    const actor = await this.db.user.findUnique({
      where: { id: userId },
      select: { is_admin: true },
    });

    const isCommentAuthor = comment.userId === userId;
    const isPostAuthor = post.userId === userId;
    const isAdmin = Boolean(actor?.is_admin);
    if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
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
