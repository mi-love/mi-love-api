import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PaginationUtils } from '@/common/services/pagination.service';
import { PaymentService } from '@/common/services/payment.service';
import { PaystackService } from '@/common/services/paystack.service';

@Module({
  imports: [],
  controllers: [WalletController],
  providers: [WalletService, PaginationUtils, PaymentService, PaystackService],
  exports: [],
})
export class WalletModule {}
