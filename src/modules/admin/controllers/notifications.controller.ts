import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../../common/guards/admin-role.guard';
import { User } from '../../../common/decorator/user.decorator';
import { AdminNotificationsService } from '../services/notifications.service';
import {
  SendNotificationDto,
  BulkSendNotificationsDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  ListNotificationLogsQueryDto,
} from '../dtos/notification-management.dto';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminNotificationsController {
  constructor(private notificationsService: AdminNotificationsService) {}

  @Post('send')
  async sendNotification(
    @Body() data: SendNotificationDto,
    @User() user: any,
  ) {
    return this.notificationsService.sendNotification(data, user.id);
  }

  @Post('send-bulk')
  async bulkSendNotifications(
    @Body() data: BulkSendNotificationsDto,
    @User() user: any,
  ) {
    // Convert to multiple single notifications or queue job
    return this.notificationsService.sendNotification(
      {
        target: data.target,
        userId: data.target === 'user' ? data.userIds?.[0] : undefined,
        segment: data.segment,
        channel: data.channel,
        templateId: data.templateId,
        variables: data.variables,
        title: data.title,
        body: data.body,
      },
      user.id,
    );
  }

  @Get('templates')
  async getNotificationTemplates(@User() user: any) {
    return this.notificationsService.getNotificationTemplates(user.id);
  }

  @Post('templates')
  async createNotificationTemplate(
    @Body() data: CreateNotificationTemplateDto,
    @User() user: any,
  ) {
    return this.notificationsService.createNotificationTemplate(data, user.id);
  }

  @Patch('templates/:id')
  async updateNotificationTemplate(
    @Param('id') templateId: string,
    @Body() data: UpdateNotificationTemplateDto,
    @User() user: any,
  ) {
    return this.notificationsService.updateNotificationTemplate(
      templateId,
      data,
      user.id,
    );
  }

  @Delete('templates/:id')
  async deleteNotificationTemplate(
    @Param('id') templateId: string,
    @User() user: any,
  ) {
    return this.notificationsService.deleteNotificationTemplate(templateId, user.id);
  }

  @Get('logs')
  async getNotificationLogs(
    @Query() query: ListNotificationLogsQueryDto,
    @User() user: any,
  ) {
    return this.notificationsService.getNotificationLogs(query, user.id);
  }

  @Get('stats')
  async getNotificationStatsSummary(@User() user: any) {
    return this.notificationsService.getNotificationStatsSummary(user.id);
  }
}
