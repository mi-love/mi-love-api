import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { PaginationUtils } from '@/common/services/pagination.service';

@Module({
  controllers: [StatusController],
  providers: [StatusService, PaginationUtils],
})
export class StatusModule {}
