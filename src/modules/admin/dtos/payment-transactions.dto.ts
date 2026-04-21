import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { status_type, subscription_status, refund_status } from '@prisma/client';

// Transactions DTOs
export class ListTransactionsQueryDto {
  @IsOptional()
  @IsEnum(status_type)
  status?: status_type;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class TransactionDetailsDto {
  id: string;
  amount: number;
  fee?: number;
  type: string;
  description?: string;
  status: status_type;
  currency: string;
  payment_link?: string;
  provider_ref?: string;
  userId: string;
  created_at: Date;
  updated_at: Date;
}

// Subscriptions DTOs
export class ListSubscriptionsQueryDto {
  @IsOptional()
  @IsEnum(subscription_status)
  status?: subscription_status;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SubscriptionDetailsDto {
  id: string;
  userId: string;
  plan_name: string;
  amount: number;
  status: subscription_status;
  start_at?: Date;
  end_at?: Date;
  auto_renew: boolean;
  provider_ref?: string;
  created_at: Date;
  updated_at: Date;
}

// Refunds DTOs
export class ListRefundsQueryDto {
  @IsOptional()
  @IsEnum(refund_status)
  status?: refund_status;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateRefundDto {
  @IsString()
  reason?: string;
}

export class RefundDetailsDto {
  id: string;
  transactionId: string;
  requesterId?: string;
  amount: number;
  reason?: string;
  status: refund_status;
  processed_at?: Date;
  failure_reason?: string;
  created_at: Date;
}

// Wallet DTO
export class WalletDetailsDto {
  id: string;
  balance: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
  recentTransactions?: TransactionDetailsDto[];
}

// Fraud Detection DTOs
export class DuplicateTransactionsDto {
  transactions: TransactionDetailsDto[];
  similarityScore: number;
  duplicateType: 'identical' | 'similar'; // identical amounts within timeframe, similar patterns
}

// Revenue Analytics DTOs
export class RevenueAnalyticsQueryDto {
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  type?: 'daily' | 'weekly' | 'monthly' = 'daily';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RevenueMetricsDto {
  period: string;
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageTransactionValue: number;
  subscriptionRevenue: number;
  refundedAmount: number;
  netRevenue: number;
}

// Payment Summary DTO
export class PaymentSummaryDto {
  totalTransactions: number;
  totalRevenue: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  activeSubscriptions: number;
  pendingRefunds: number;
  totalRefunded: number;
  averageTransactionValue: number;
}
