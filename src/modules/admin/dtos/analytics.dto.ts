import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

// User Metrics DTOs
export class UserMetricsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  groupBy?: 'daily' | 'weekly' | 'monthly' = 'daily';
}

export class UserMetricsDto {
  period: string;
  newUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  deletedUsers: number;
  bannedUsers: number;
  suspendedUsers: number;
}

export class RetentionMetricsDto {
  period: string;
  totalUsers: number;
  retentionRate: number;
  churnRate: number;
  returningUsers: number;
}

// Engagement Metrics DTOs
export class EngagementMetricsDto {
  period: string;
  matchesCount: number;
  messagesSent: number;
  messagesReceived: number;
  postsCreated: number;
  postsLiked: number;
  commentsCreated: number;
  averageEngagementPerUser: number;
  totalEngagementScore: number;
}

export class EngagementQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  groupBy?: 'daily' | 'weekly' | 'monthly' = 'daily';
}

// Conversion Metrics DTOs
export class ConversionMetricsDto {
  period: string;
  freeToPaidRate: number;
  freeUsers: number;
  paidUsers: number;
  totalConversions: number;
  conversionValue: number;
  subscriptionConversionRate: number;
}

export class ConversionQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Panic Alert Analytics DTOs
export class PanicAlertMetricsDto {
  period: string;
  totalAlerts: number;
  resolvedAlerts: number;
  unResolvedAlerts: number;
  avgResolutionTime: number; // in minutes
  alertsByHour: { hour: number; count: number }[];
  topLocations: { location: string; count: number }[];
  responseRate: number; // percentage
}

export class PanicAlertQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['resolved', 'unresolved', 'all'])
  status?: 'resolved' | 'unresolved' | 'all' = 'all';
}

// Geographic Insights DTOs
export class GeographicMetricsDto {
  country: string;
  city?: string;
  userCount: number;
  activeUserCount: number;
  engagementScore: number;
  averageSessionDuration: number;
  conversionRate: number;
}

export class GeographicQueryDto {
  @IsOptional()
  @IsEnum(['country', 'city'])
  groupBy?: 'country' | 'city' = 'country';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// Export Reports DTOs
export class ExportReportsQueryDto {
  @IsOptional()
  @IsEnum(['csv', 'pdf'])
  type?: 'csv' | 'pdf' = 'csv';

  @IsEnum(['users', 'transactions', 'subscriptions', 'analytics', 'panic_alerts'])
  reportType: 'users' | 'transactions' | 'subscriptions' | 'analytics' | 'panic_alerts';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Analytics Summary DTO
export class AnalyticsSummaryDto {
  users: {
    total: number;
    active: number;
    new: number;
    retention: number;
  };
  engagement: {
    totalMessages: number;
    totalMatches: number;
    totalPosts: number;
    averageSessionTime: number;
  };
  revenue: {
    totalRevenue: number;
    subscriptionRevenue: number;
    averageTransactionValue: number;
    conversionRate: number;
  };
  panicAlerts: {
    total: number;
    resolved: number;
    avgResolutionTime: number;
  };
  geography: {
    topCountries: { country: string; userCount: number }[];
    userDistribution: { country: string; percentage: number }[];
  };
}
