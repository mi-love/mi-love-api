import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PaginationParams } from '@/common/services/pagination.service';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getNotifications(
    @Query() query: PaginationParams,
    @User() user: UserWithoutPassword,
  ) {
    return this.notificationService.getNotifications(query, user.id);
  }
}
