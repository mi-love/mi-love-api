import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '@/database/database.service';
import { createPostDto, getPostsDto } from './posts.dto';
import { Prisma } from '@prisma/client';
import { UserWithoutPassword } from '@/common/types/db';
import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';

@Injectable()
export class PostsService {
  constructor(
    private db: DbService,
    private paginationUtils: PaginationUtils,
  ) {}

  async getAllPosts({
    query,
  }: {
    query: getPostsDto;
    user?: UserWithoutPassword;
  }) {
    const { filterValue, filterBy, ...queryParams } = query;
    console.log('filterBy', filterBy);
    const { skip, limit } = this.paginationUtils.getPagination(queryParams);

    const where: Prisma.postWhereInput = {
      content: {
        contains: filterValue,
      },
    };

    const allPosts = await this.db.post.count({
      where,
    });

    const posts = await this.db.post.findMany({
      where,
      skip,
      take: Number(limit),
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

  async getPostById(id: string) {
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
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
      });
    }

    return {
      data: post,
    };
  }

  async deletePost(id: string) {
    const post = await this.db.post.findUnique({
      where: { id },
    });
    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
      });
    }
    const post_ = await this.db.post.delete({
      where: { id },
    });

    return post_;
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
        user: {
          connect: {
            id: user.id,
          },
        },
        files: {
          connect: post.files.map((file) => ({ id: file })),
        },
      },
      include: {
        files: true,
      },
    });

    return {
      message: 'Post created successfully',
      data: post_,
    };
  }

  async likePost({ postId, userId }: { postId: string; userId: string }) {
    const post = await this.db.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException({
        message: 'Post not found',
      });
    }

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

  async getPostLikes(postId: string, query: PaginationParams) {
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

    const likes = await this.db.post.findUnique({
      where: { id: postId },
      include: {
        likes: {
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

  // NOT A FEATURE YET
  // async likeComment({
  //   commentId,
  //   userId,
  // }: {
  //   commentId: string;
  //   userId: string;
  // }) {
  //   const comment = await this.db.comment.findUnique({
  //     where: { id: commentId },
  //   });

  //   if (!comment) {
  //     throw new NotFoundException({
  //       message: 'Comment not found',
  //     });
  //   }

  //   await this.db.comment.update({
  //     where: { id: commentId },
  //     data: {
  //       likes: { connect: { id: userId } },
  //     },
  //   });

  //   return {
  //     message: 'Comment liked successfully',
  //   };
  // }

  // async unlikeComment({
  //   commentId,
  //   userId,
  // }: {
  //   commentId: string;
  //   userId: string;
  // }) {
  //   await this.db.comment.update({
  //     where: { id: commentId },
  //     data: {
  //       likes: { disconnect: { id: userId } },
  //     },
  //   });

  //   return {
  //     message: 'Comment unliked successfully',
  //   };
  // }

  // async getCommentLikes(commentId: string, query: PaginationParams) {
  //   const { skip, limit } = this.paginationUtils.getPagination(query);

  //   const allLikes = await this.db.comment.findUnique({
  //     where: { id: commentId },
  //     select: {
  //       _count: {
  //         select: {
  //           likes: true,
  //         },
  //       },
  //     },
  //   });

  //   const likes = await this.db.comment.findUnique({
  //     where: { id: commentId },
  //     include: {
  //       likes: {
  //         skip,
  //         take: limit,
  //       },
  //     },
  //   });

  //   return {
  //     data: likes?.likes || [],
  //     meta: this.paginationUtils.getMeta({
  //       totalItems: allLikes?._count?.likes || 0,
  //       page: query.page,
  //       limit: query.limit,
  //     }),
  //   };
  // }

  // async getPostComments(postId: string, query: PaginationParams) {
  //   const { skip, limit } = this.paginationUtils.getPagination(query);

  //   const allComments = await this.db.post.findUnique({
  //     where: { id: postId },
  //     select: {
  //       _count: {
  //         select: {
  //           comments: true,
  //         },
  //       },
  //     },
  //   });

  //   const comments = await this.db.post.findUnique({
  //     where: { id: postId },
  //     include: {
  //       comments: {
  //         skip,
  //         take: limit,
  //       },
  //     },
  //   });

  //   return {
  //     data: comments?.comments || [],
  //     meta: this.paginationUtils.getMeta({
  //       totalItems: allComments?._count?.comments || 0,
  //       page: query.page,
  //       limit: query.limit,
  //     }),
  //   };
  // }

  // async createComment({
  //   postId,
  //   userId,
  //   content,
  // }: {
  //   postId: string;
  //   userId: string;
  //   content: string;
  // }) {
  //   const post = await this.db.post.findUnique({
  //     where: { id: postId },
  //   });

  //   if (!post) {
  //     throw new NotFoundException({
  //       message: 'Post not found',
  //     });
  //   }

  //   const comment = await this.db.comment.create({
  //     data: {
  //       content,
  //       user: {
  //         connect: { id: userId },
  //       },
  //       post: {
  //         connect: { id: postId },
  //       },
  //     },
  //   });

  //   return {
  //     message: 'Comment created successfully',
  //     data: comment,
  //   };
  // }

  // async deleteComment({ id, userId }: { id: string; userId: string }) {
  //   const comment = await this.db.comment.findUnique({
  //     where: { id, userId },
  //   });

  //   if (!comment) {
  //     throw new NotFoundException({
  //       message: 'Comment not found',
  //     });
  //   }

  //   await this.db.comment.delete({
  //     where: { id, userId },
  //   });

  //   return {
  //     message: 'Comment deleted successfully',
  //   };
  // }

  //   async updatePost(id: string, post: PostDto) {
  //     const updatedPost = await this.db.post.update({
  //       where: { id },
  //       data: post,
  //     });
  //     return updatedPost;
  //   }
}
