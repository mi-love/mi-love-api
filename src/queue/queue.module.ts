import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LoggerService } from '../common/services/logger.service';

// Job Consumers
import { NotificationQueueConsumer } from './consumers/notification-queue.consumer';
import { RefundQueueConsumer } from './consumers/refund-queue.consumer';
import { ReportGenerationConsumer } from './consumers/report-generation.consumer';
import { FraudDetectionConsumer } from './consumers/fraud-detection.consumer';
import { VIDEO_UPLOAD_QUEUE } from './consumers/video-upload.consumer';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'refunds' },
      { name: 'report-generation' },
      { name: 'fraud-detection' },
      { name: VIDEO_UPLOAD_QUEUE },
    ),
    DatabaseModule,
  ],
  providers: [
    LoggerService,
    NotificationQueueConsumer,
    RefundQueueConsumer,
    ReportGenerationConsumer,
    FraudDetectionConsumer,
  ],
  exports: [BullModule],
})
export class QueueModule {}
