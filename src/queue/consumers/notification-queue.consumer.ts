import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { DbService } from '../../database/database.service';
import { LoggerService } from '../../common/services/logger.service';
import { notification_channel, status_type } from '@prisma/client';

@Injectable()
@Processor('notifications')
export class NotificationQueueConsumer {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  @Process('send-email')
  async sendEmailNotification(job: Job<any>) {
    try {
      const { notificationLogId, recipient, title, body } = job.data;

      this.logger.log(
        `Sending email notification to ${recipient}`,
        'NotificationQueueConsumer',
      );

      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      // For now, just log it
      const sent = Math.random() > 0.1; // 90% success rate for demo

      await this.db.notification_log.update({
        where: { id: notificationLogId },
        data: {
          status: sent ? status_type.success : status_type.failed,
          sent_at: new Date(),
          error_message: !sent ? 'Email service error' : undefined,
        },
      });

      return { success: sent };
    } catch (error) {
      this.logger.error(
        `Error sending email notification`,
        error.stack,
        'NotificationQueueConsumer',
      );
      throw error;
    }
  }

  @Process('send-sms')
  async sendSmsNotification(job: Job<any>) {
    try {
      const { notificationLogId, phone, body } = job.data;

      this.logger.log(
        `Sending SMS notification to ${phone}`,
        'NotificationQueueConsumer',
      );

      // TODO: Integrate with SMS service (Twilio, etc.)
      const sent = Math.random() > 0.05; // 95% success rate for demo

      await this.db.notification_log.update({
        where: { id: notificationLogId },
        data: {
          status: sent ? status_type.success : status_type.failed,
          sent_at: new Date(),
          error_message: !sent ? 'SMS service error' : undefined,
        },
      });

      return { success: sent };
    } catch (error) {
      this.logger.error(
        `Error sending SMS notification`,
        error.stack,
        'NotificationQueueConsumer',
      );
      throw error;
    }
  }

  @Process('send-push')
  async sendPushNotification(job: Job<any>) {
    try {
      const { notificationLogId, userId, title, body } = job.data;

      this.logger.log(
        `Sending push notification to user ${userId}`,
        'NotificationQueueConsumer',
      );

      // TODO: Integrate with push notification service (Expo, Firebase, etc.)
      const sent = true;

      await this.db.notification_log.update({
        where: { id: notificationLogId },
        data: {
          status: sent ? status_type.success : status_type.failed,
          sent_at: new Date(),
        },
      });

      return { success: sent };
    } catch (error) {
      this.logger.error(
        `Error sending push notification`,
        error.stack,
        'NotificationQueueConsumer',
      );
      throw error;
    }
  }

  @Process('batch-send')
  async sendBatchNotifications(job: Job<any>) {
    try {
      const { userIds, templateId, channel, variables } = job.data;

      this.logger.log(
        `Sending batch notifications to ${userIds.length} users via ${channel}`,
        'NotificationQueueConsumer',
      );

      const chunkSize = 100;
      let sent = 0;

      for (let i = 0; i < userIds.length; i += chunkSize) {
        const chunk = userIds.slice(i, i + chunkSize);

        // Process chunk
        for (const userId of chunk) {
          await job.progress((i + chunk.indexOf(userId)) / userIds.length);
          // Send notification
          sent++;
        }
      }

      return { success: true, sent };
    } catch (error) {
      this.logger.error(
        `Error sending batch notifications`,
        error.stack,
        'NotificationQueueConsumer',
      );
      throw error;
    }
  }
}
