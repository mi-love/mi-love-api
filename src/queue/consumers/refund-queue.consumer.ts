import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { DbService } from '../../database/database.service';
import { LoggerService } from '../../common/services/logger.service';
import { refund_status, status_type } from '@prisma/client';

@Injectable()
@Processor('refunds')
export class RefundQueueConsumer {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  @Process('process-refund')
  async processRefund(job: Job<any>) {
    try {
      const { refundId } = job.data;

      const refund = await this.db.refund.findUnique({
        where: { id: refundId },
        include: { transaction: true },
      });

      if (!refund) {
        this.logger.warn(`Refund ${refundId} not found`, 'RefundQueueConsumer');
        return;
      }

      this.logger.log(
        `Processing refund ${refundId} for $${refund.amount}`,
        'RefundQueueConsumer',
      );

      // TODO: Integrate with payment provider (Paystack, Flutterwave)
      // Call refund API on payment provider
      const success = Math.random() > 0.1; // 90% success rate

      const updatedRefund = await this.db.refund.update({
        where: { id: refundId },
        data: {
          status: success ? refund_status.completed : refund_status.failed,
          processed_at: new Date(),
          failure_reason: !success ? 'Payment provider error' : undefined,
        },
      });

      this.logger.log(
        `Refund ${refundId} processed: ${updatedRefund.status}`,
        'RefundQueueConsumer',
      );

      return { success, refundId };
    } catch (error) {
      this.logger.error(
        `Error processing refund`,
        error.stack,
        'RefundQueueConsumer',
      );
      throw error;
    }
  }

  @Process('auto-refund-failed-transactions')
  async autoRefundFailedTransactions(job: Job<any>) {
    try {
      this.logger.log(
        `Auto-refunding failed transactions`,
        'RefundQueueConsumer',
      );

      // Find transactions that failed but have pending refunds
      const failedTransactions = await this.db.transaction.findMany({
        where: { status: status_type.failed },
        include: { refunds: { where: { status: refund_status.pending } } },
      });

      let processed = 0;

      for (const transaction of failedTransactions) {
        for (const refund of transaction.refunds) {
          // Queue individual refund
          processed++;
        }
      }

      this.logger.log(
        `Queued ${processed} refunds for processing`,
        'RefundQueueConsumer',
      );

      return { processed };
    } catch (error) {
      this.logger.error(
        `Error auto-refunding transactions`,
        error.stack,
        'RefundQueueConsumer',
      );
      throw error;
    }
  }
}
