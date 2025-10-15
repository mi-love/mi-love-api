import { Controller, Get, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PaginationParams } from '@/common/services/pagination.service';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';

@Controller('notifications')
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
