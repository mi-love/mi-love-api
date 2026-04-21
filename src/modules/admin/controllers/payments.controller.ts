import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../../common/guards/admin-role.guard';
import { User } from '../../../common/decorator/user.decorator';
import { AdminPaymentsService } from '../services/payments.service';
import {
  ListTransactionsQueryDto,
  ListSubscriptionsQueryDto,
  ListRefundsQueryDto,
  CreateRefundDto,
  RevenueAnalyticsQueryDto,
} from '../dtos/payment-transactions.dto';

@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminTransactionsController {
  constructor(private paymentsService: AdminPaymentsService) {}

  @Get()
  async listTransactions(
    @Query() query: ListTransactionsQueryDto,
    @User() user: any,
  ) {
    return this.paymentsService.listTransactions(query, user.id);
  }

  @Get(':id')
  async getTransactionDetails(@Param('id') transactionId: string, @User() user: any) {
    return this.paymentsService.getTransactionDetails(transactionId, user.id);
  }

  @Get('duplicates')
  async findDuplicateTransactions(@User() user: any) {
    return this.paymentsService.findDuplicateTransactions(user.id);
  }
}

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSubscriptionsController {
  constructor(private paymentsService: AdminPaymentsService) {}

  @Get()
  async listSubscriptions(
    @Query() query: ListSubscriptionsQueryDto,
    @User() user: any,
  ) {
    return this.paymentsService.listSubscriptions(query, user.id);
  }

  @Get(':userId')
  async getUserSubscriptions(@Param('userId') userId: string, @User() user: any) {
    return this.paymentsService.getUserSubscriptions(userId, user.id);
  }
}

@Controller('admin/refunds')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminRefundsController {
  constructor(private paymentsService: AdminPaymentsService) {}

  @Get()
  async listRefunds(@Query() query: ListRefundsQueryDto, @User() user: any) {
    return this.paymentsService.listRefunds(query, user.id);
  }

  @Post(':transactionId')
  async createRefund(
    @Param('transactionId') transactionId: string,
    @Body() data: CreateRefundDto,
    @User() user: any,
  ) {
    return this.paymentsService.createRefund(transactionId, data, user.id);
  }
}

@Controller('admin/wallets')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminWalletsController {
  constructor(private paymentsService: AdminPaymentsService) {}

  @Get(':userId')
  async getWalletDetails(@Param('userId') userId: string, @User() user: any) {
    return this.paymentsService.getWalletDetails(userId, user.id);
  }
}

@Controller('admin/revenue')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminRevenueController {
  constructor(private paymentsService: AdminPaymentsService) {}

  @Get('analytics')
  async getRevenueAnalytics(
    @Query() query: RevenueAnalyticsQueryDto,
    @User() user: any,
  ) {
    return this.paymentsService.getRevenueAnalytics(query, user.id);
  }

  @Get('summary')
  async getPaymentSummary(@User() user: any) {
    return this.paymentsService.getPaymentSummary(user.id);
  }
}
