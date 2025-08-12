import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StatusService } from './status.service';
import { User } from '@/common/decorator/user.decorator';
import { PaginationParams } from '@/common/services/pagination.service';
import { UserWithoutPassword } from '@/common/types/db';
import { createStatusDto } from './status.dto';

@Controller('status')
@UseGuards(JwtAuthGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  getAll(@User() user: UserWithoutPassword, @Query() query: PaginationParams) {
    return this.statusService.getStatuses(user.id, {
      limit: Number(query.limit || 3),
      page: Number(query.page || 1),
    });
  }

  @Get('/me')
  getMyStatuses(
    @User() user: UserWithoutPassword,
    @Query() query: PaginationParams,
  ) {
    return this.statusService.getMyStatuses(user.id, {
      limit: Number(query.limit || 3),
      page: Number(query.page || 1),
    });
  }

  @Post('/')
  createStatus(
    @User() user: UserWithoutPassword,
    @Body() body: createStatusDto,
  ) {
    return this.statusService.createStatus(body, user.id);
  }

  @Delete('/:id')
  deleteStatus(@User() user: UserWithoutPassword, @Param('id') id: string) {
    return this.statusService.deleteStatus(id, user.id);
  }
}
