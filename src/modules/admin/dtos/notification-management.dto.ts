import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  IsObject,
} from 'class-validator';
import {
  notification_channel,
  notification_target,
  status_type,
} from '@prisma/client';

// Send Notification DTOs
export class SendNotificationDto {
  @IsEnum(notification_target)
  target: notification_target; // all, segment, user

  @IsOptional()
  @IsString()
  userId?: string; // required if target is 'user'

  @IsOptional()
  @IsString()
  segment?: string; // required if target is 'segment' (e.g., "premium_users", "new_users")

  @IsEnum(notification_channel)
  channel: notification_channel; // in_app, email, sms

  @IsString()
  templateId: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>; // variables to interpolate in template

  @IsOptional()
  @IsString()
  title?: string; // override template title

  @IsOptional()
  @IsString()
  body?: string; // override template body
}

export class NotificationResponseDto {
  id: string;
  templateId?: string;
  userId?: string;
  channel: notification_channel;
  target: notification_target;
  status: status_type;
  message?: string;
  sent_at?: Date;
  error_message?: string;
  created_at: Date;
}

// Bulk Send Notifications DTO
export class BulkSendNotificationsDto {
  @IsEnum(notification_target)
  target: notification_target;

  @IsOptional()
  @IsArray()
  userIds?: string[]; // if target is 'user'

  @IsOptional()
  @IsString()
  segment?: string; // if target is 'segment'

  @IsEnum(notification_channel)
  channel: notification_channel;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  batchSize?: number = 100; // process in batches
}

// Templates DTOs
export class CreateNotificationTemplateDto {
  @IsString()
  name: string;

  @IsEnum(notification_channel)
  channel: notification_channel;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>; // { variableName: "description" }
}

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  isActive?: boolean;
}

export class NotificationTemplateDto {
  id: string;
  name: string;
  channel: notification_channel;
  title: string;
  body: string;
  variables?: Record<string, string>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Notification Logs DTOs
export class ListNotificationLogsQueryDto {
  @IsOptional()
  @IsEnum(notification_channel)
  channel?: notification_channel;

  @IsOptional()
  @IsEnum(status_type)
  status?: status_type;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class NotificationLogDetailDto {
  id: string;
  templateId?: string;
  userId?: string;
  channel: notification_channel;
  target: notification_target;
  status: status_type;
  message?: string;
  variables?: Record<string, any>;
  error_message?: string;
  sent_at?: Date;
  created_at: Date;
}

// Notification Statistics DTOs
export class NotificationStatsDto {
  period: string;
  totalSent: number;
  successfulNotifications: number;
  failedNotifications: number;
  pendingNotifications: number;
  byChannel: {
    in_app: number;
    email: number;
    sms: number;
  };
  successRate: number;
  failureRate: number;
}

export class NotificationStatsSummaryDto {
  totalNotificationsSent: number;
  totalNotificationsSuccessful: number;
  totalNotificationsFailed: number;
  successRate: number;
  topTemplates: {
    templateName: string;
    count: number;
    successRate: number;
  }[];
  topChannels: {
    channel: notification_channel;
    count: number;
    successRate: number;
  }[];
}

// Scheduled Notifications DTO
export class ScheduleNotificationDto {
  @IsString()
  templateId: string;

  @IsEnum(notification_target)
  target: notification_target;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsEnum(notification_channel)
  channel: notification_channel;

  @IsString()
  scheduledFor: string; // ISO 8601 datetime

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
