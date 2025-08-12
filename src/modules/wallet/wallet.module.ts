import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PaginationUtils } from '@/common/services/pagination.service';

@Module({
  imports: [],
  controllers: [WalletController],
  providers: [WalletService, PaginationUtils],
  exports: [],
})
export class WalletModule {}
