import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { createPostDto, getPostsDto } from './posts.dto';
import { Request } from 'express';
import { PaginationParams } from '@/common/services/pagination.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get('/')
  async getAllPosts(@Query() query: getPostsDto, @Req() req: Request) {
    return await this.postsService.getAllPosts({ query, user: req.user });
  }

  @Get('/:id')
  async getPostById(@Param('id') id: string) {
    return await this.postsService.getPostById(id);
  }

  @Delete('/:id')
  async deletePost(@Param('id') id: string) {
    return this.postsService.deletePost(id);
  }

  @Post('/')
  async createPost(@Body() body: createPostDto, @Req() req: Request) {
    return this.postsService.createPost({
      post: body,
      user: req.user,
    });
  }

  @Post('/:id/like')
  async likePost(@Param('id') id: string, @Req() req: Request) {
    return this.postsService.likePost({
      postId: id,
      userId: req.user.id,
    });
  }

  @Post('/:id/unlike')
  async unlikePost(@Param('id') id: string, @Req() req: Request) {
    return this.postsService.unlikePost({
      postId: id,
      userId: req.user.id,
    });
  }

  @Get('/:id/likes')
  async getPostLikes(
    @Param('id') id: string,
    @Query() query: PaginationParams,
  ) {
    return this.postsService.getPostLikes(id, query);
  }

  // NOT A FEATURE YET
  // @Post('/:id/comment')
  // async createComment(
  //   @Param('id') id: string,
  //   @Body() body: createCommentDto,
  //   @Req() req: Request,
  // ) {
  //   return this.postsService.createComment({
  //     postId: id,
  //     userId: req.user.id,
  //     content: body.content,
  //   });
  // }

  // @Post('/:id/comment/:commentId/like')
  // async likeComment(
  //   @Param('id') id: string,
  //   @Param('commentId') commentId: string,
  //   @Req() req: Request,
  // ) {
  //   return this.postsService.likeComment({
  //     commentId,
  //     userId: req.user.id,
  //   });
  // }

  // @Post('/:id/comment/:commentId/unlike')
  // async unlikeComment(
  //   @Param('id') id: string,
  //   @Param('commentId') commentId: string,
  //   @Req() req: Request,
  // ) {
  //   return this.postsService.unlikeComment({
  //     commentId,
  //     userId: req.user.id,
  //   });
  // }

  // @Get('/:id/comment/:commentId/likes')
  // async getCommentLikes(
  //   @Param('id') id: string,
  //   @Param('commentId') commentId: string,
  //   @Query() query: PaginationParams,
  // ) {
  //   return this.postsService.getCommentLikes(commentId, query);
  // }

  // @Get('/:id/comment/:commentId/comments')
  // async getPostComments(
  //   @Param('id') id: string,
  //   @Query() query: PaginationParams,
  // ) {
  //   return this.postsService.getPostComments(id, query);
  // }

  // @Delete('/:id/comment/:commentId')
  // async deleteComment(
  //   @Param('id') id: string,
  //   @Param('commentId') commentId: string,
  //   @Req() req: Request,
  // ) {
  //   return this.postsService.deleteComment({
  //     id: commentId,
  //     userId: req.user.id,
  //   });
  // }
}
