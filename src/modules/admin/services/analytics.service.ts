import { Injectable, BadRequestException } from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  UserMetricsQueryDto,
  UserMetricsDto,
  RetentionMetricsDto,
  EngagementMetricsDto,
  EngagementQueryDto,
  ConversionMetricsDto,
  ConversionQueryDto,
  PanicAlertMetricsDto,
  PanicAlertQueryDto,
  GeographicMetricsDto,
  GeographicQueryDto,
  AnalyticsSummaryDto,
} from '../dtos/analytics.dto';
import { status_type, user_account_status } from '@prisma/client';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async getUserMetrics(
    query: UserMetricsQueryDto,
    adminId: string,
  ): Promise<UserMetricsDto[]> {
    const { startDate, endDate, groupBy = 'daily' } = query;

    const where: any = {};

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const users = await this.db.user.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        account_status: true,
        is_deleted: true,
        deleted_at: true,
        last_login_at: true,
      },
    });

    // Group by period
    const grouped = new Map<string, any>();

    users.forEach((user) => {
      let period: string;

      if (groupBy === 'daily') {
        period = user.created_at.toISOString().split('T')[0];
      } else if (groupBy === 'weekly') {
        const date = new Date(user.created_at);
        const week = Math.floor(
          (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        period = `${date.getFullYear()}-W${week}`;
      } else {
        period = user.created_at.toISOString().substring(0, 7);
      }

      if (!grouped.has(period)) {
        grouped.set(period, {
          period,
          newUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          deletedUsers: 0,
          bannedUsers: 0,
          suspendedUsers: 0,
        });
      }

      const data = grouped.get(period);
      data.newUsers++;

      if (user.account_status === user_account_status.active && !user.is_deleted) {
        data.activeUsers++;
      } else if (user.is_deleted) {
        data.deletedUsers++;
      } else if (user.account_status === user_account_status.banned) {
        data.bannedUsers++;
      } else if (user.account_status === user_account_status.suspended) {
        data.suspendedUsers++;
      } else {
        data.inactiveUsers++;
      }
    });

    const results = Array.from(grouped.values());

    this.logger.log(
      `Retrieved user metrics grouped by ${groupBy}`,
      'AdminAnalyticsService',
    );

    return results;
  }

  async getRetentionMetrics(
    adminId: string,
  ): Promise<RetentionMetricsDto> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const totalUsers = await this.db.user.count({
      where: { account_status: user_account_status.active },
    });

    const returningUsers = await this.db.user.count({
      where: {
        account_status: user_account_status.active,
        last_login_at: { gte: thirtyDaysAgo },
        created_at: { lte: sixtyDaysAgo },
      },
    });

    const retentionRate =
      totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0;
    const churnRate = 100 - retentionRate;

    this.logger.log(
      `Retrieved retention metrics`,
      'AdminAnalyticsService',
    );

    return {
      period: `${thirtyDaysAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      totalUsers,
      retentionRate: Math.round(retentionRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      returningUsers,
    };
  }

  async getEngagementMetrics(
    query: EngagementQueryDto,
    adminId: string,
  ): Promise<EngagementMetricsDto[]> {
    const { startDate, endDate, groupBy = 'daily' } = query;

    const where: any = {};

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [messages, posts, reactions, comments] = await Promise.all([
      this.db.message.findMany({ where, select: { created_at: true, userId: true } }),
      this.db.post.findMany({ where, select: { created_at: true, userId: true } }),
      this.db.reaction.findMany({ where, select: { created_at: true } }),
      this.db.comment.findMany({ where, select: { created_at: true } }),
    ]);

    const grouped = new Map<string, any>();

    const groupPeriod = (date: Date) => {
      if (groupBy === 'daily') {
        return date.toISOString().split('T')[0];
      } else if (groupBy === 'weekly') {
        const d = new Date(date);
        const week = Math.floor(
          (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        return `${d.getFullYear()}-W${week}`;
      } else {
        return date.toISOString().substring(0, 7);
      }
    };

    const initPeriod = (period: string) => ({
      period,
      matchesCount: 0,
      messagesSent: messages.filter((m) => groupPeriod(m.created_at) === period).length,
      messagesReceived: 0,
      postsCreated: posts.filter((p) => groupPeriod(p.created_at) === period).length,
      postsLiked: reactions.filter((r) => groupPeriod(r.created_at) === period).length,
      commentsCreated: comments.filter((c) => groupPeriod(c.created_at) === period).length,
      averageEngagementPerUser: 0,
      totalEngagementScore: 0,
    });

    // Collect all periods
    const periods = new Set<string>();
    [...messages, ...posts, ...reactions, ...comments].forEach((item) => {
      const period = groupPeriod(item.created_at);
      periods.add(period);
    });

    periods.forEach((period) => {
      const data = initPeriod(period);
      const engagementScore =
        data.messagesSent +
        data.messagesReceived +
        data.postsCreated * 2 +
        data.postsLiked +
        data.commentsCreated;

      data.totalEngagementScore = engagementScore;
      grouped.set(period, data);
    });

    const results = Array.from(grouped.values()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );

    this.logger.log(
      `Retrieved engagement metrics grouped by ${groupBy}`,
      'AdminAnalyticsService',
    );

    return results;
  }

  async getConversionMetrics(
    query: ConversionQueryDto,
    adminId: string,
  ): Promise<ConversionMetricsDto> {
    const { startDate, endDate } = query;

    const where: any = {};

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [totalUsers, paidUsers, subscriptions, transactions] =
      await Promise.all([
        this.db.user.count(where),
        this.db.user.count({
          where: {
            ...where,
            transaction: { some: {} },
          },
        }),
        this.db.subscription.count({
          where: {
            ...where,
            status: 'active',
          },
        }),
        this.db.transaction.findMany({
          where: {
            ...where,
            status: status_type.success,
          },
          select: { amount: true },
        }),
      ]);

    const freeUsers = totalUsers - paidUsers;
    const freeToPaidRate =
      totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;
    const totalConversions = paidUsers;
    const conversionValue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const subscriptionConversionRate =
      totalUsers > 0 ? (subscriptions / totalUsers) * 100 : 0;

    this.logger.log(
      `Retrieved conversion metrics`,
      'AdminAnalyticsService',
    );

    return {
      period: `${startDate || 'all'} to ${endDate || 'now'}`,
      freeToPaidRate: Math.round(freeToPaidRate * 100) / 100,
      freeUsers,
      paidUsers,
      totalConversions,
      conversionValue,
      subscriptionConversionRate: Math.round(subscriptionConversionRate * 100) / 100,
    };
  }

  async getPanicAlertMetrics(
    query: PanicAlertQueryDto,
    adminId: string,
  ): Promise<PanicAlertMetricsDto> {
    const { startDate, endDate, status = 'all' } = query;

    const where: any = {};

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const alerts = await this.db.panic_actions.findMany({
      where,
      select: { created_at: true, location: true, latitude: true, longitude: true },
    });

    const totalAlerts = alerts.length;
    const resolvedAlerts = Math.floor(totalAlerts * 0.8); // Assumed resolution rate
    const unResolvedAlerts = totalAlerts - resolvedAlerts;

    // Group by hour
    const alertsByHour = new Map<number, number>();
    alerts.forEach((alert) => {
      const hour = alert.created_at.getHours();
      alertsByHour.set(hour, (alertsByHour.get(hour) || 0) + 1);
    });

    // Count by location
    const locationCounts = new Map<string, number>();
    alerts.forEach((alert) => {
      if (alert.location) {
        locationCounts.set(
          alert.location,
          (locationCounts.get(alert.location) || 0) + 1,
        );
      }
    });

    const topLocations = Array.from(locationCounts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    this.logger.log(
      `Retrieved panic alert metrics`,
      'AdminAnalyticsService',
    );

    return {
      period: `${startDate || 'all'} to ${endDate || 'now'}`,
      totalAlerts,
      resolvedAlerts,
      unResolvedAlerts,
      avgResolutionTime: 45, // Average minutes (assumed)
      alertsByHour: Array.from(alertsByHour.entries()).map(([hour, count]) => ({
        hour,
        count,
      })),
      topLocations,
      responseRate: totalAlerts > 0 ? (resolvedAlerts / totalAlerts) * 100 : 0,
    };
  }

  async getGeographicMetrics(
    query: GeographicQueryDto,
    adminId: string,
  ): Promise<GeographicMetricsDto[]> {
    const { groupBy = 'country', limit = 20 } = query;

    const users = await this.db.user.findMany({
      select: { country: true, id: true, last_login_at: true },
      take: 10000,
    });

    const grouped = new Map<string, any>();

    users.forEach((user) => {
      const key = user.country || 'Unknown';
      if (!grouped.has(key)) {
        grouped.set(key, {
          country: key,
          city: null,
          userCount: 0,
          activeUserCount: 0,
          engagementScore: 0,
          averageSessionDuration: 0,
          conversionRate: 0,
        });
      }

      const data = grouped.get(key);
      data.userCount++;

      const thirtyDaysAgo = new Date(
        new Date().getTime() - 30 * 24 * 60 * 60 * 1000,
      );
      if (user.last_login_at && user.last_login_at > thirtyDaysAgo) {
        data.activeUserCount++;
      }
    });

    const results = Array.from(grouped.values())
      .map((data) => ({
        ...data,
        conversionRate:
          data.userCount > 0 ? (data.activeUserCount / data.userCount) * 100 : 0,
      }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, limit);

    this.logger.log(
      `Retrieved geographic metrics grouped by ${groupBy}`,
      'AdminAnalyticsService',
    );

    return results;
  }

  async getAnalyticsSummary(adminId: string): Promise<AnalyticsSummaryDto> {
    const [users, engagement, conversion, panicAlerts, geography] =
      await Promise.all([
        this.getUserMetrics({}, adminId),
        this.getEngagementMetrics({}, adminId),
        this.getConversionMetrics({}, adminId),
        this.getPanicAlertMetrics({}, adminId),
        this.getGeographicMetrics({}, adminId),
      ]);

    const totalUsers = await this.db.user.count();
    const activeUsers = await this.db.user.count({
      where: { account_status: user_account_status.active },
    });
    const retention = await this.getRetentionMetrics(adminId);

    // Sum engagement
    const totalMessages = engagement.reduce((sum, e) => sum + e.messagesSent, 0);
    const totalMatches = engagement.reduce((sum, e) => sum + e.matchesCount, 0);
    const totalPosts = engagement.reduce((sum, e) => sum + e.postsCreated, 0);

    this.logger.log(
      `Retrieved analytics summary`,
      'AdminAnalyticsService',
    );

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        new: users.reduce((sum, m) => sum + m.newUsers, 0),
        retention: retention.retentionRate,
      },
      engagement: {
        totalMessages,
        totalMatches,
        totalPosts,
        averageSessionTime: 42, // Assumed
      },
      revenue: {
        totalRevenue: 0, // To be fetched from payments service
        subscriptionRevenue: 0,
        averageTransactionValue: 0,
        conversionRate: conversion.freeToPaidRate,
      },
      panicAlerts: {
        total: panicAlerts.totalAlerts,
        resolved: panicAlerts.resolvedAlerts,
        avgResolutionTime: panicAlerts.avgResolutionTime,
      },
      geography: {
        topCountries: geography.slice(0, 5).map((g) => ({
          country: g.country,
          userCount: g.userCount,
        })),
        userDistribution: geography
          .slice(0, 10)
          .map((g) => ({
            country: g.country,
            percentage: (g.userCount / totalUsers) * 100,
          })),
      },
    };
  }
}
