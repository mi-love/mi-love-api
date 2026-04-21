import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { DbService } from '../../database/database.service';
import { LoggerService } from '../../common/services/logger.service';
import { user_account_status, status_type } from '@prisma/client';

@Injectable()
@Processor('fraud-detection')
export class FraudDetectionConsumer {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  @Process('detect-duplicate-accounts')
  async detectDuplicateAccounts(job: Job<any>) {
    try {
      this.logger.log(
        `Running duplicate account detection`,
        'FraudDetectionConsumer',
      );

      // Find users with similar information
      const users = await this.db.user.findMany({
        select: {
          id: true,
          email: true,
          phone_number: true,
          first_name: true,
          last_name: true,
        },
      });

      const duplicates: any[] = [];

      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
          const user1 = users[i];
          const user2 = users[j];

          // Check if same phone number
          if (user1.phone_number && user1.phone_number === user2.phone_number) {
            duplicates.push({
              user1Id: user1.id,
              user2Id: user2.id,
              reason: 'same_phone_number',
              confidence: 0.95,
            });
          }

          // Check if same name and similar email
          if (
            user1.first_name === user2.first_name &&
            user1.last_name === user2.last_name &&
            user1.email.split('@')[0] === user2.email.split('@')[0]
          ) {
            duplicates.push({
              user1Id: user1.id,
              user2Id: user2.id,
              reason: 'same_name_similar_email',
              confidence: 0.85,
            });
          }
        }
      }

      // Create user_link records for detected duplicates
      for (const duplicate of duplicates) {
        const existingLink = await this.db.user_link.findUnique({
          where: {
            sourceUserId_targetUserId: {
              sourceUserId: duplicate.user1Id,
              targetUserId: duplicate.user2Id,
            },
          },
        });

        if (!existingLink) {
          await this.db.user_link.create({
            data: {
              sourceUserId: duplicate.user1Id,
              targetUserId: duplicate.user2Id,
              reason: duplicate.reason,
              confidence_score: duplicate.confidence,
            },
          });
        }
      }

      this.logger.log(
        `Found ${duplicates.length} potential duplicate accounts`,
        'FraudDetectionConsumer',
      );

      return { found: duplicates.length };
    } catch (error) {
      this.logger.error(
        `Error detecting duplicate accounts`,
        error.stack,
        'FraudDetectionConsumer',
      );
      throw error;
    }
  }

  @Process('detect-suspicious-transactions')
  async detectSuspiciousTransactions(job: Job<any>) {
    try {
      this.logger.log(
        `Running suspicious transaction detection`,
        'FraudDetectionConsumer',
      );

      // Find patterns like:
      // 1. Multiple failed transactions in short time
      // 2. Unusual transaction amounts
      // 3. Multiple transactions from same IP

      const suspiciousPatterns = [];

      // Pattern 1: Multiple failed transactions
      const failedTransactions = await this.db.transaction.groupBy({
        by: ['userId'],
        where: {
          status: status_type.failed,
          created_at: {
            gte: new Date(Date.now() - 1 * 60 * 60 * 1000), // Last hour
          },
        },
        _count: true,
      });

      const highFailureUsers = failedTransactions.filter((g) => g._count >= 3);

      for (const user of highFailureUsers) {
        suspiciousPatterns.push({
          userId: user.userId,
          pattern: 'multiple_failed_transactions',
          severity: 'medium',
          count: user._count,
        });

        // Flag user
        await this.db.user.update({
          where: { id: user.userId },
          data: { is_flagged: true },
        });
      }

      // Pattern 2: Unusually high amounts
      const highAmountTransactions = await this.db.transaction.findMany({
        where: {
          status: status_type.success,
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
          amount: { gt: 10000 }, // > $10,000
        },
      });

      suspiciousPatterns.push(...highAmountTransactions.map((t) => ({
        transactionId: t.id,
        pattern: 'high_amount',
        severity: 'low',
        amount: t.amount,
      })));

      this.logger.log(
        `Found ${suspiciousPatterns.length} suspicious transaction patterns`,
        'FraudDetectionConsumer',
      );

      return { found: suspiciousPatterns.length };
    } catch (error) {
      this.logger.error(
        `Error detecting suspicious transactions`,
        error.stack,
        'FraudDetectionConsumer',
      );
      throw error;
    }
  }

  @Process('verify-accounts')
  async verifyAccountHealth(job: Job<any>) {
    try {
      this.logger.log(
        `Running account health verification`,
        'FraudDetectionConsumer',
      );

      // Check for accounts that should be flagged or suspended based on activity
      const suspendedCount = await this.db.user.count({
        where: { account_status: user_account_status.suspended },
      });

      const bannedCount = await this.db.user.count({
        where: { account_status: user_account_status.banned },
      });

      this.logger.log(
        `Account health check: ${suspendedCount} suspended, ${bannedCount} banned`,
        'FraudDetectionConsumer',
      );

      return { suspended: suspendedCount, banned: bannedCount };
    } catch (error) {
      this.logger.error(
        `Error verifying account health`,
        error.stack,
        'FraudDetectionConsumer',
      );
      throw error;
    }
  }
}
