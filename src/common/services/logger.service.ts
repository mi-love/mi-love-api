import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'mi-love-api' },
      transports: [
        // Error logs
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
        }),
        // Combined logs
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log'),
        }),
        // Admin action logs
        new winston.transports.File({
          filename: path.join(logsDir, 'admin.log'),
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json(),
          ),
        }),
      ],
    });

    // Add console logging in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      );
    }
  }

  log(message: string, context?: string, meta?: any) {
    this.logger.info(message, {
      context,
      ...meta,
    });
  }

  error(message: string, trace?: string, context?: string, meta?: any) {
    this.logger.error(message, {
      context,
      trace,
      ...meta,
    });
  }

  warn(message: string, context?: string, meta?: any) {
    this.logger.warn(message, {
      context,
      ...meta,
    });
  }

  debug(message: string, context?: string, meta?: any) {
    this.logger.debug(message, {
      context,
      ...meta,
    });
  }

  logAdminAction(
    adminId: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: any,
  ) {
    this.logger.info('Admin Action', {
      adminId,
      action,
      resource,
      resourceId,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }
}
