import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  SendNotificationDto,
  NotificationResponseDto,
  BulkSendNotificationsDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  ListNotificationLogsQueryDto,
  NotificationStatsSummaryDto,
  PaginatedResponseDto,
} from '../dtos/notification-management.dto';
import { status_type } from '@prisma/client';

@Injectable()
export class AdminNotificationsService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async sendNotification(
    data: SendNotificationDto,
    adminId: string,
  ): Promise<NotificationResponseDto> {
    // Validate input
    if (data.target === 'user' && !data.userId) {
      throw new BadRequestException('userId is required for target "user"');
    }
    if (data.target === 'segment' && !data.segment) {
      throw new BadRequestException('segment is required for target "segment"');
    }

    // If templateId is provided, fetch and use template
    let template;
    if (data.templateId) {
      template = await this.db.notification_template.findUnique({
        where: { id: data.templateId },
      });

      if (!template) {
        throw new NotFoundException(`Template ${data.templateId} not found`);
      }
    }

    // Interpolate variables
    let title = data.title || template?.title || 'Notification';
    let body = data.body || template?.body || '';

    if (data.variables) {
      Object.entries(data.variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(regex, String(value));
        body = body.replace(regex, String(value));
      });
    }

    // Determine recipients
    let userIds: string[] = [];
    if (data.target === 'user') {
      userIds = [data.userId];
    } else if (data.target === 'segment') {
      // Handle segment logic
      userIds = await this.getUsersBySegment(data.segment);
    } else if (data.target === 'all') {
      const users = await this.db.user.findMany({
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    // For single notification, create log
    if (userIds.length === 1) {
      const log = await this.db.notification_log.create({
        data: {
          templateId: data.templateId,
          userId: userIds[0],
          channel: data.channel,
          target: data.target,
          status: status_type.pending,
          message: body,
          variables: data.variables,
        },
      });

      // Create in-app notification if channel is in_app
      if (data.channel === 'in_app') {
        await this.db.notification.create({
          data: {
            title,
            body,
            type: 'system',
            userId: userIds[0],
          },
        });
      }

      this.logger.logAdminAction(
        adminId,
        'SEND_NOTIFICATION',
        'notification',
        log.id,
        data,
      );

      return {
        id: log.id,
        templateId: data.templateId,
        userId: userIds[0],
        channel: data.channel,
        target: data.target,
        status: status_type.pending,
        message: body,
        created_at: log.created_at,
      };
    }

    // For bulk, schedule background job
    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'BULK_SEND_NOTIFICATION',
        resource: 'notification',
        metadata: {
          ...data,
          recipientCount: userIds.length,
        },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'BULK_SEND_NOTIFICATION',
      'notification',
      undefined,
      { ...data, recipientCount: userIds.length },
    );

    // TODO: Queue bulk send job in BullMQ
    return {
      id: 'queued',
      channel: data.channel,
      target: data.target,
      status: status_type.pending,
      message: `Bulk notification queued for ${userIds.length} recipients`,
      created_at: new Date(),
    } as NotificationResponseDto;
  }

  async getNotificationTemplates(
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const templates = await this.db.notification_template.findMany({
      orderBy: { created_at: 'desc' },
    });

    const total = templates.length;

    this.logger.log(
      `Retrieved ${templates.length} notification templates`,
      'AdminNotificationsService',
    );

    return {
      data: templates,
      pagination: {
        page: 1,
        limit: 100,
        total,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  async createNotificationTemplate(
    data: CreateNotificationTemplateDto,
    adminId: string,
  ): Promise<any> {
    const existingTemplate = await this.db.notification_template.findUnique({
      where: { name: data.name },
    });

    if (existingTemplate) {
      throw new BadRequestException(`Template "${data.name}" already exists`);
    }

    const template = await this.db.notification_template.create({
      data: {
        name: data.name,
        channel: data.channel,
        title: data.title,
        body: data.body,
        variables: data.variables,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'CREATE_TEMPLATE',
        resource: 'notification_template',
        resource_id: template.id,
        metadata: data,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'CREATE_TEMPLATE',
      'notification_template',
      template.id,
      data,
    );

    return template;
  }

  async updateNotificationTemplate(
    templateId: string,
    data: UpdateNotificationTemplateDto,
    adminId: string,
  ): Promise<any> {
    const template = await this.db.notification_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const updated = await this.db.notification_template.update({
      where: { id: templateId },
      data: {
        name: data.name || template.name,
        title: data.title || template.title,
        body: data.body || template.body,
        variables: data.variables || template.variables,
        is_active: data.isActive !== undefined ? data.isActive : template.is_active,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'UPDATE_TEMPLATE',
        resource: 'notification_template',
        resource_id: templateId,
        metadata: data,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'UPDATE_TEMPLATE',
      'notification_template',
      templateId,
      data,
    );

    return updated;
  }

  async deleteNotificationTemplate(
    templateId: string,
    adminId: string,
  ): Promise<{ message: string }> {
    const template = await this.db.notification_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    await this.db.notification_template.delete({
      where: { id: templateId },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'DELETE_TEMPLATE',
        resource: 'notification_template',
        resource_id: templateId,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'DELETE_TEMPLATE',
      'notification_template',
      templateId,
    );

    return { message: `Template ${templateId} deleted successfully` };
  }

  async getNotificationLogs(
    query: ListNotificationLogsQueryDto,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 20, channel, status, templateId, userId, startDate, endDate } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (channel) {
      where.channel = channel;
    }
    if (status) {
      where.status = status;
    }
    if (templateId) {
      where.templateId = templateId;
    }
    if (userId) {
      where.userId = userId;
    }
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      this.db.notification_log.findMany({
        where,
        skip,
        take: limit,
        include: {
          template: { select: { id: true, name: true } },
          user: { select: { id: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.db.notification_log.count({ where }),
    ]);

    this.logger.log(
      `Retrieved ${logs.length} notification logs`,
      'AdminNotificationsService',
    );

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async getNotificationStatsSummary(
    adminId: string,
  ): Promise<NotificationStatsSummaryDto> {
    const totalSent = await this.db.notification_log.count();
    const successfulNotifications = await this.db.notification_log.count({
      where: { status: status_type.success },
    });
    const failedNotifications = await this.db.notification_log.count({
      where: { status: status_type.failed },
    });

    const successRate =
      totalSent > 0 ? (successfulNotifications / totalSent) * 100 : 0;

    // Top templates
    const topTemplatesData = await this.db.notification_log.groupBy({
      by: ['templateId'],
      _count: true,
      orderBy: { _count: { desc: true } },
      take: 5,
    });

    const topTemplates = await Promise.all(
      topTemplatesData.map(async (item) => {
        const template = await this.db.notification_template.findUnique({
          where: { id: item.templateId! },
        });
        const successful = await this.db.notification_log.count({
          where: {
            templateId: item.templateId,
            status: status_type.success,
          },
        });

        return {
          templateName: template?.name || 'Unknown',
          count: item._count,
          successRate: (successful / item._count) * 100,
        };
      }),
    );

    // Top channels
    const topChannelsData = await this.db.notification_log.groupBy({
      by: ['channel'],
      _count: true,
      orderBy: { _count: { desc: true } },
    });

    const topChannels = topChannelsData.map((item) => ({
      channel: item.channel,
      count: item._count,
      successRate: 0, // Can be calculated similarly
    }));

    this.logger.log(
      `Retrieved notification statistics summary`,
      'AdminNotificationsService',
    );

    return {
      totalNotificationsSent: totalSent,
      totalNotificationsSuccessful: successfulNotifications,
      totalNotificationsFailed: failedNotifications,
      successRate: Math.round(successRate * 100) / 100,
      topTemplates,
      topChannels,
    };
  }

  private async getUsersBySegment(segment: string): Promise<string[]> {
    // Implement segment logic
    const segmentRules: Record<string, any> = {
      premium_users: {
        subscription: {
          some: { status: 'active' },
        },
      },
      new_users: {
        created_at: {
          gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      active_users: {
        last_login_at: {
          gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      inactive_users: {
        last_login_at: {
          lte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    };

    const where = segmentRules[segment] || {};
    const users = await this.db.user.findMany({
      where,
      select: { id: true },
    });

    return users.map((u) => u.id);
  }
}
