import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PaginationUtils } from '@/common/services/pagination.service';

@Global()
@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PaginationUtils],
  exports: [NotificationService],
})
export class NotificationModule {}
