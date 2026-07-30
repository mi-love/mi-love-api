import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  createCommentDto,
  createPostDto,
  getPostsDto,
  updatePostDto,
} from './posts.dto';
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

  @Put('/:id')
  async updatePost(
    @Body() body: updatePostDto,
    @Param('id') param: string,
    @Req() req: Request,
  ) {
    return await this.postsService.updatePost({
      userId: req.user.id,
      body,
      postId: param,
    });
  }

  @Get('/:id/comments')
  async getPostComments(
    @Param('id') id: string,
    @Query() query: PaginationParams & { order?: 'asc' | 'desc' },
    @Req() req: Request,
  ) {
    return this.postsService.getPostComments(id, req.user.id, query);
  }

  @Post('/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Param('id') id: string,
    @Body() body: createCommentDto,
    @Req() req: Request,
  ) {
    return this.postsService.createComment({
      postId: id,
      userId: req.user.id,
      body,
      username: req.user.username,
    });
  }

  @Delete('/:id/comments/:commentId')
  async deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: Request,
  ) {
    return this.postsService.deleteComment({
      postId: id,
      commentId,
      userId: req.user.id,
    });
  }

  @Get('/:id')
  async getPostById(@Param('id') id: string, @Req() req: Request) {
    return await this.postsService.getPostById(id, req.user.id);
  }

  @Delete('/:id')
  async deletePost(@Param('id') id: string, @Req() req: Request) {
    return this.postsService.deletePost(id, req.user.id);
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
    @Req() req: Request,
  ) {
    return this.postsService.getPostLikes(id, query, req.user.id);
  }
}
