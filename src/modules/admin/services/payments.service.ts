import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  ListTransactionsQueryDto,
  ListSubscriptionsQueryDto,
  ListRefundsQueryDto,
  CreateRefundDto,
  RevenueAnalyticsQueryDto,
  RevenueMetricsDto,
  PaymentSummaryDto,
  PaginatedResponseDto,
} from '../dtos/payment-transactions.dto';
import { status_type, subscription_status, refund_status } from '@prisma/client';

@Injectable()
export class AdminPaymentsService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async listTransactions(
    query: ListTransactionsQueryDto,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const { status, startDate, endDate, page = 1, limit = 20 } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [transactions, total] = await Promise.all([
      this.db.transaction.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, email: true, username: true } } },
        orderBy: { created_at: 'desc' },
      }),
      this.db.transaction.count({ where }),
    ]);

    this.logger.log(
      `Listed ${transactions.length} transactions`,
      'AdminPaymentsService',
    );

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async getTransactionDetails(
    transactionId: string,
    adminId: string,
  ): Promise<any> {
    const transaction = await this.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            first_name: true,
            last_name: true,
          },
        },
        refunds: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    this.logger.log(
      `Retrieved transaction ${transactionId}`,
      'AdminPaymentsService',
    );

    return transaction;
  }

  async listSubscriptions(
    query: ListSubscriptionsQueryDto,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const { status, page = 1, limit = 20 } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    const [subscriptions, total] = await Promise.all([
      this.db.subscription.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, email: true, username: true } } },
        orderBy: { created_at: 'desc' },
      }),
      this.db.subscription.count({ where }),
    ]);

    this.logger.log(
      `Listed ${subscriptions.length} subscriptions`,
      'AdminPaymentsService',
    );

    return {
      data: subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async getUserSubscriptions(
    userId: string,
    adminId: string,
  ): Promise<any[]> {
    const subscriptions = await this.db.subscription.findMany({
      where: { userId },
      orderBy: { created_at: 'desc' },
    });

    this.logger.log(
      `Retrieved ${subscriptions.length} subscriptions for user ${userId}`,
      'AdminPaymentsService',
    );

    return subscriptions;
  }

  async listRefunds(
    query: ListRefundsQueryDto,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const { status, page = 1, limit = 20 } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    const [refunds, total] = await Promise.all([
      this.db.refund.findMany({
        where,
        skip,
        take: limit,
        include: {
          transaction: {
            include: {
              user: { select: { id: true, email: true, username: true } },
            },
          },
          requester: { select: { id: true, email: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.db.refund.count({ where }),
    ]);

    this.logger.log(`Listed ${refunds.length} refunds`, 'AdminPaymentsService');

    return {
      data: refunds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async createRefund(
    transactionId: string,
    data: CreateRefundDto,
    adminId: string,
  ): Promise<{ message: string; refundId: string }> {
    const transaction = await this.db.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== status_type.success) {
      throw new BadRequestException(
        'Can only refund successful transactions',
      );
    }

    const existingRefund = await this.db.refund.findFirst({
      where: { transactionId, status: refund_status.pending },
    });

    if (existingRefund) {
      throw new BadRequestException('A refund is already pending for this transaction');
    }

    const refund = await this.db.refund.create({
      data: {
        transactionId,
        amount: transaction.amount,
        reason: data.reason,
        status: refund_status.pending,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'CREATE_REFUND',
        resource: 'refund',
        resource_id: refund.id,
        metadata: { transactionId, ...data },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'CREATE_REFUND',
      'refund',
      refund.id,
      { transactionId, ...data },
    );

    return { message: 'Refund created successfully', refundId: refund.id };
  }

  async getWalletDetails(
    userId: string,
    adminId: string,
  ): Promise<any> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        transaction: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    this.logger.log(
      `Retrieved wallet details for user ${userId}`,
      'AdminPaymentsService',
    );

    return {
      id: user.wallet.id,
      balance: user.wallet.balance,
      currency: 'USD',
      created_at: user.wallet.created_at,
      updated_at: user.wallet.updated_at,
      recentTransactions: user.transaction,
    };
  }

  async findDuplicateTransactions(
    adminId: string,
  ): Promise<any[]> {
    // Find transactions with same amount from same user within 24 hours
    const transactionGroups = await this.db.transaction.groupBy({
      by: ['userId', 'amount'],
      where: {
        created_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        status: status_type.success,
      },
      _count: true,
    });

    const duplicates = transactionGroups
      .filter((g) => g._count > 1)
      .map((g) => ({
        userId: g.userId,
        amount: g.amount,
        count: g._count,
        duplicateType: 'identical',
        similarityScore: 1.0,
      }));

    this.logger.log(
      `Found ${duplicates.length} duplicate transaction patterns`,
      'AdminPaymentsService',
    );

    return duplicates;
  }

  async getRevenueAnalytics(
    query: RevenueAnalyticsQueryDto,
    adminId: string,
  ): Promise<RevenueMetricsDto[]> {
    const { type = 'daily', startDate, endDate } = query;

    const where: any = {
      status: status_type.success,
    };

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const transactions = await this.db.transaction.findMany({
      where,
      include: { refunds: true },
    });

    // Group by period
    const grouped = new Map<string, any>();

    transactions.forEach((tx) => {
      let period: string;

      if (type === 'daily') {
        period = tx.created_at.toISOString().split('T')[0];
      } else if (type === 'weekly') {
        const date = new Date(tx.created_at);
        const week = Math.floor(
          (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        period = `${date.getFullYear()}-W${week}`;
      } else {
        period = tx.created_at.toISOString().substring(0, 7);
      }

      if (!grouped.has(period)) {
        grouped.set(period, {
          period,
          totalRevenue: 0,
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          averageTransactionValue: 0,
          subscriptionRevenue: 0,
          refundedAmount: 0,
          netRevenue: 0,
        });
      }

      const data = grouped.get(period);
      data.totalTransactions++;
      data.successfulTransactions++;
      data.totalRevenue += tx.amount;

      const totalRefunded = tx.refunds.reduce((sum, r) => sum + r.amount, 0);
      data.refundedAmount += totalRefunded;
      data.netRevenue = data.totalRevenue - data.refundedAmount;
    });

    // Calculate averages
    const results = Array.from(grouped.values()).map((data) => ({
      ...data,
      averageTransactionValue:
        data.totalTransactions > 0
          ? data.totalRevenue / data.totalTransactions
          : 0,
    }));

    this.logger.log(
      `Retrieved revenue analytics for ${type}`,
      'AdminPaymentsService',
    );

    return results;
  }

  async getPaymentSummary(adminId: string): Promise<PaymentSummaryDto> {
    try {
      const [
        totalTransactions,
        successfulTransactions,
        failedTransactions,
        pendingTransactions,
        totalRevenue,
        activeSubscriptions,
        pendingRefunds,
        totalRefunded,
      ] = await Promise.all([
        this.db.transaction.count(),
        this.db.transaction.count({ where: { status: status_type.success } }),
        this.db.transaction.count({ where: { status: status_type.failed } }),
        this.db.transaction.count({ where: { status: status_type.pending } }),
        this.db.transaction.aggregate({
          where: { status: status_type.success },
          _sum: { amount: true },
        }),
        this.db.subscription.count({
          where: { status: subscription_status.active },
        }),
        this.db.refund.count({ where: { status: refund_status.pending } }),
        this.db.refund.aggregate({
          where: { status: refund_status.completed },
          _sum: { amount: true },
        }),
      ]);

      const averageTransactionValue =
        totalTransactions > 0
          ? (totalRevenue._sum.amount || 0) / totalTransactions
          : 0;

      this.logger.log(`Retrieved payment summary`, 'AdminPaymentsService');

      return {
        totalTransactions,
        totalRevenue: totalRevenue._sum.amount || 0,
        successfulTransactions,
        failedTransactions,
        pendingTransactions,
        activeSubscriptions,
        pendingRefunds,
        totalRefunded: totalRefunded._sum.amount || 0,
        averageTransactionValue,
      };
    } catch {
      this.logger.warn(
        'Payment summary fallback: returning zeros because database is unavailable',
        'AdminPaymentsService',
      );

      return {
        totalTransactions: 0,
        totalRevenue: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        pendingTransactions: 0,
        activeSubscriptions: 0,
        pendingRefunds: 0,
        totalRefunded: 0,
        averageTransactionValue: 0,
      };
    }
  }
}
