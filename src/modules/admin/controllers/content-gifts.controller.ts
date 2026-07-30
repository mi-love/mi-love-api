import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../../common/guards/admin-role.guard';
import { User } from '../../../common/decorator/user.decorator';
import { AdminContentService } from '../services/content.service';
import { AdminGiftsService } from '../services/gifts.service';
import {
  CreateGiftCategoryDto,
  CreateGiftDto,
  DeleteContentDto,
  ListAdminCommentsQueryDto,
  ListAdminPostsQueryDto,
  ListGiftsQueryDto,
  UpdateGiftCategoryDto,
  UpdateGiftDto,
} from '../dtos/content-gifts.dto';

@Controller('admin/posts')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminPostsController {
  constructor(private contentService: AdminContentService) {}

  @Get()
  listPosts(@Query() query: ListAdminPostsQueryDto, @User() user: any) {
    return this.contentService.listPosts(query, user.id);
  }

  @Get(':id')
  getPost(@Param('id') id: string, @User() user: any) {
    return this.contentService.getPost(id, user.id);
  }

  @Delete(':id')
  deletePost(
    @Param('id') id: string,
    @Body() data: DeleteContentDto,
    @User() user: any,
  ) {
    return this.contentService.deletePost(id, data, user.id);
  }
}

@Controller('admin/comments')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminCommentsController {
  constructor(private contentService: AdminContentService) {}

  @Get()
  listComments(@Query() query: ListAdminCommentsQueryDto, @User() user: any) {
    return this.contentService.listComments(query, user.id);
  }

  @Delete(':id')
  deleteComment(
    @Param('id') id: string,
    @Body() data: DeleteContentDto,
    @User() user: any,
  ) {
    return this.contentService.deleteComment(id, data, user.id);
  }
}

@Controller('admin/gifts')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminGiftsController {
  constructor(private giftsService: AdminGiftsService) {}

  @Get('categories')
  listCategories(@User() user: any) {
    return this.giftsService.listCategories(user.id);
  }

  @Post('categories')
  createCategory(@Body() data: CreateGiftCategoryDto, @User() user: any) {
    return this.giftsService.createCategory(data, user.id);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() data: UpdateGiftCategoryDto,
    @User() user: any,
  ) {
    return this.giftsService.updateCategory(id, data, user.id);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string, @User() user: any) {
    return this.giftsService.deleteCategory(id, user.id);
  }

  @Get()
  listGifts(@Query() query: ListGiftsQueryDto, @User() user: any) {
    return this.giftsService.listGifts(query, user.id);
  }

  @Post()
  createGift(@Body() data: CreateGiftDto, @User() user: any) {
    return this.giftsService.createGift(data, user.id);
  }

  @Patch(':id')
  updateGift(
    @Param('id') id: string,
    @Body() data: UpdateGiftDto,
    @User() user: any,
  ) {
    return this.giftsService.updateGift(id, data, user.id);
  }

  @Delete(':id')
  deleteGift(@Param('id') id: string, @User() user: any) {
    return this.giftsService.deleteGift(id, user.id);
  }
}
