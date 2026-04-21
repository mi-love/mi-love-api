import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../../common/guards/admin-role.guard';
import { User } from '../../../common/decorator/user.decorator';
import { AdminAnalyticsService } from '../services/analytics.service';
import {
  UserMetricsQueryDto,
  EngagementQueryDto,
  ConversionQueryDto,
  PanicAlertQueryDto,
  GeographicQueryDto,
} from '../dtos/analytics.dto';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminAnalyticsController {
  constructor(private analyticsService: AdminAnalyticsService) {}

  @Get('users')
  async getUserMetrics(
    @Query() query: UserMetricsQueryDto,
    @User() user: any,
  ) {
    return this.analyticsService.getUserMetrics(query, user.id);
  }

  @Get('users/retention')
  async getRetentionMetrics(@User() user: any) {
    return this.analyticsService.getRetentionMetrics(user.id);
  }

  @Get('engagement')
  async getEngagementMetrics(
    @Query() query: EngagementQueryDto,
    @User() user: any,
  ) {
    return this.analyticsService.getEngagementMetrics(query, user.id);
  }

  @Get('conversion')
  async getConversionMetrics(
    @Query() query: ConversionQueryDto,
    @User() user: any,
  ) {
    return this.analyticsService.getConversionMetrics(query, user.id);
  }

  @Get('panic')
  async getPanicAlertMetrics(
    @Query() query: PanicAlertQueryDto,
    @User() user: any,
  ) {
    return this.analyticsService.getPanicAlertMetrics(query, user.id);
  }

  @Get('geography')
  async getGeographicMetrics(
    @Query() query: GeographicQueryDto,
    @User() user: any,
  ) {
    return this.analyticsService.getGeographicMetrics(query, user.id);
  }

  @Get('summary')
  async getAnalyticsSummary(@User() user: any) {
    return this.analyticsService.getAnalyticsSummary(user.id);
  }
}
