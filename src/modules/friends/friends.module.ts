import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { PaginationUtils } from '@/common/services/pagination.service';

@Module({
  providers: [FriendsService, PaginationUtils],
  controllers: [FriendsController],
})
export class FriendsModule {}
