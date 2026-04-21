import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { DbService } from '../../database/database.service';
import { LoggerService } from '../../common/services/logger.service';
import { status_type } from '@prisma/client';

@Injectable()
@Processor('report-generation')
export class ReportGenerationConsumer {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  @Process('generate-csv-report')
  async generateCsvReport(job: Job<any>) {
    try {
      const { reportType, startDate, endDate, adminId } = job.data;

      this.logger.log(
        `Generating CSV report for ${reportType}`,
        'ReportGenerationConsumer',
      );

      let csvContent = '';
      let filename = `${reportType}-report-${Date.now()}.csv`;

      if (reportType === 'users') {
        const users = await this.db.user.findMany({
          where: {
            created_at: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            username: true,
            account_status: true,
            is_verified: true,
            created_at: true,
          },
        });

        csvContent =
          'ID,Email,First Name,Last Name,Username,Status,Verified,Created At\n';
        csvContent += users
          .map(
            (u) =>
              `${u.id},${u.email},${u.first_name},${u.last_name},${u.username},${u.account_status},${u.is_verified},${u.created_at}`,
          )
          .join('\n');
      } else if (reportType === 'transactions') {
        const transactions = await this.db.transaction.findMany({
          where: {
            created_at: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          include: { user: { select: { email: true } } },
        });

        csvContent =
          'ID,User Email,Amount,Type,Status,Currency,Created At\n';
        csvContent += transactions
          .map(
            (t) =>
              `${t.id},${t.user.email},${t.amount},${t.type},${t.status},${t.currency},${t.created_at}`,
          )
          .join('\n');
      }

      // TODO: Store report file (S3, local storage, etc.)
      // For now, just log it
      this.logger.log(
        `Generated CSV report: ${filename} (${csvContent.length} bytes)`,
        'ReportGenerationConsumer',
      );

      // TODO: Send report to admin via email or store in database

      return { success: true, filename };
    } catch (error) {
      this.logger.error(
        `Error generating CSV report`,
        error.stack,
        'ReportGenerationConsumer',
      );
      throw error;
    }
  }

  @Process('generate-pdf-report')
  async generatePdfReport(job: Job<any>) {
    try {
      const { reportType, startDate, endDate, adminId } = job.data;

      this.logger.log(
        `Generating PDF report for ${reportType}`,
        'ReportGenerationConsumer',
      );

      let filename = `${reportType}-report-${Date.now()}.pdf`;

      // TODO: Use PDF library (PDFKit, puppeteer, etc.)
      // Generate PDF content
      // Store PDF file

      this.logger.log(
        `Generated PDF report: ${filename}`,
        'ReportGenerationConsumer',
      );

      return { success: true, filename };
    } catch (error) {
      this.logger.error(
        `Error generating PDF report`,
        error.stack,
        'ReportGenerationConsumer',
      );
      throw error;
    }
  }

  @Process('scheduled-report')
  async generateScheduledReport(job: Job<any>) {
    try {
      const { reportType, frequency } = job.data; // daily, weekly, monthly

      this.logger.log(
        `Generating ${frequency} scheduled report for ${reportType}`,
        'ReportGenerationConsumer',
      );

      const endDate = new Date();
      let startDate: Date;

      if (frequency === 'daily') {
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      } else if (frequency === 'weekly') {
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (frequency === 'monthly') {
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Generate report
      // Store and notify admins

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error generating scheduled report`,
        error.stack,
        'ReportGenerationConsumer',
      );
      throw error;
    }
  }
}
