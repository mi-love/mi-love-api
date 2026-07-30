import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

// Controllers
import {
  AdminUserManagementController,
  AdminVerificationController,
  AdminAuditLogsController,
} from './controllers/user-management.controller';
import {
  AdminTransactionsController,
  AdminSubscriptionsController,
  AdminRefundsController,
  AdminWalletsController,
  AdminRevenueController,
} from './controllers/payments.controller';
import { AdminAnalyticsController } from './controllers/analytics.controller';
import { AdminNotificationsController } from './controllers/notifications.controller';
import { AdminSupportController } from './controllers/support.controller';
import { AdminChatManagementController } from './controllers/chat-management.controller';
import {
  AdminPostsController,
  AdminCommentsController,
  AdminGiftsController,
} from './controllers/content-gifts.controller';

// Services
import { AdminUserManagementService } from './services/user-management.service';
import { AdminPaymentsService } from './services/payments.service';
import { AdminAnalyticsService } from './services/analytics.service';
import { AdminNotificationsService } from './services/notifications.service';
import { AdminSupportService } from './services/support.service';
import { AdminChatManagementService } from './services/chat-management.service';
import { AdminContentService } from './services/content.service';
import { AdminGiftsService } from './services/gifts.service';

// Common
import { LoggerService } from '../../common/services/logger.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    AdminUserManagementController,
    AdminVerificationController,
    AdminAuditLogsController,
    AdminTransactionsController,
    AdminSubscriptionsController,
    AdminRefundsController,
    AdminWalletsController,
    AdminRevenueController,
    AdminAnalyticsController,
    AdminNotificationsController,
    AdminSupportController,
    AdminChatManagementController,
    AdminPostsController,
    AdminCommentsController,
    AdminGiftsController,
  ],
  providers: [
    LoggerService,
    AdminUserManagementService,
    AdminPaymentsService,
    AdminAnalyticsService,
    AdminNotificationsService,
    AdminSupportService,
    AdminChatManagementService,
    AdminContentService,
    AdminGiftsService,
  ],
  exports: [
    AdminUserManagementService,
    AdminPaymentsService,
    AdminAnalyticsService,
    AdminNotificationsService,
    AdminSupportService,
    AdminChatManagementService,
    AdminContentService,
    AdminGiftsService,
  ],
})
export class AdminModule {}
