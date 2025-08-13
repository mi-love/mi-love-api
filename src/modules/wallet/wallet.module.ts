import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PaginationUtils } from '@/common/services/pagination.service';
import { PaymentService } from '@/common/services/payment.service';

@Module({
  imports: [],
  controllers: [WalletController],
  providers: [WalletService, PaginationUtils, PaymentService],
  exports: [],
})
export class WalletModule {}
