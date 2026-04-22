# Admin Endpoint Response Types and Interfaces

This document defines response object interfaces for all current admin endpoints.

```ts
// -----------------------------------------------------------------------------
// Shared primitives
// -----------------------------------------------------------------------------

type ISODateString = string;

type AdminRole = 'super_admin' | 'moderator' | 'finance';
type UserAccountStatus = 'active' | 'suspended' | 'banned' | 'deleted';
type VerificationStatus = 'pending' | 'approved' | 'rejected';
type TwoFactorMethod = '2fa_email' | '2fa_sms' | '2fa_authenticator';
type NotificationChannel = 'in_app' | 'email' | 'sms';
type NotificationTarget = 'all' | 'segment' | 'user';
type NotificationStatus = 'pending' | 'success' | 'failed';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
type TicketCategory = 'technical' | 'billing' | 'complaint' | 'feature_request' | 'other';
type TransactionStatus = 'pending' | 'success' | 'failed';
type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'canceled';
type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'rejected';

type MessageResponse = {
  message: string;
};

type Paginated<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

// -----------------------------------------------------------------------------
// Admin Auth endpoints
// -----------------------------------------------------------------------------

type AdminAuthLoginResponse = {
  access_token: string;
};

type AdminAuthCreateUserResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
  access_token: string;
};

type AdminAuthLogoutResponse = MessageResponse;

// -----------------------------------------------------------------------------
// Admin Users + Verifications
// -----------------------------------------------------------------------------

type AdminUserListItem = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  account_status: UserAccountStatus;
  is_verified: boolean;
  is_flagged: boolean;
  banned_at?: ISODateString | null;
  suspended_at?: ISODateString | null;
  created_at: ISODateString;
  last_login_at?: ISODateString | null;
};

type AdminUsersListResponse = Paginated<AdminUserListItem>;

type AdminDashboardStatsResponse = {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  verifiedUsers: number;
  flaggedUsers: number;
  pendingVerifications: number;
  newUsersThisMonth: number;
  newUsersThisWeek: number;
};

type AdminUserDetailsResponse = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  bio?: string;
  phone_number?: string;
  country?: string;
  account_status: UserAccountStatus;
  is_verified: boolean;
  is_flagged: boolean;
  banned_at?: ISODateString;
  suspended_at?: ISODateString;
  last_login_at?: ISODateString;
  created_at: ISODateString;
  profile?: {
    bio?: string;
    photos?: unknown[];
    preferences?: unknown;
  };
  activityMetrics?: {
    lastLogin?: ISODateString;
    matchesCount?: number;
    chatsCount?: number;
    postsCount?: number;
  };
};

type AdminSessionsResponse = Paginated<{
  id: string;
  userId: string;
  token_hash?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: ISODateString;
  revoked_at?: ISODateString | null;
  last_seen_at?: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}>;

type AdminDevicesResponse = Paginated<{
  id: string;
  userId: string;
  device_id: string;
  platform?: string | null;
  os_version?: string | null;
  app_version?: string | null;
  ip_address?: string | null;
  last_seen_at?: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}>;

type AdminLinkedAccountsResponse = Paginated<{
  id: string;
  sourceUserId: string;
  targetUserId: string;
  reason?: string | null;
  confidence_score?: number | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}>;

type AdminUserSecurityProfileResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber?: string;
  country?: string;
  city?: string;
  bio?: string;
  accountStatus: UserAccountStatus;
  isVerified: boolean;
  is2faEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  lastLogin?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  suspendedAt?: ISODateString;
  bannedAt?: ISODateString;
};

type Admin2faStatusResponse = {
  userId: string;
  is2faEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  enabledAt?: ISODateString;
  lastUsedAt?: ISODateString;
};

type AdminVerificationsListResponse = Paginated<{
  id: string;
  userId: string;
  status: VerificationStatus;
  type: string;
  document_url?: string | null;
  reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}>;

// Most user mutation endpoints return a simple message
// (suspend, ban, reactivate, delete, profile resets, 2fa enable/disable, reactivation notification)
type AdminUserMutationResponse = MessageResponse;

// -----------------------------------------------------------------------------
// Admin Chats
// -----------------------------------------------------------------------------

type AdminChatListItem = {
  id: string;
  participants: Array<{
    id: string;
    email: string;
    username: string;
    avatar?: string;
  }>;
  messageCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastMessageAt?: ISODateString;
  isActive: boolean;
};

type AdminChatsListResponse = Paginated<AdminChatListItem>;

type AdminChatMessageItem = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type?: 'text' | 'image' | 'file';
  fileUrl?: string;
  read: boolean;
  readAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

type AdminChatMessagesResponse = Paginated<AdminChatMessageItem>;

type AdminChatStatisticsResponse = {
  totalChats: number;
  activeChats: number;
  archivedChats: number;
  totalMessages: number;
  averageMessageLength?: number;
  messagesPerDay?: number;
  chatsByDate?: Record<string, number>;
  topChatParticipants?: Array<{
    userId: string;
    username: string;
    messageCount: number;
  }>;
};

type AdminUserMessageStatisticsResponse = {
  totalMessages: number;
  chatsParticipated: number;
  lastMessageAt?: ISODateString;
};

type AdminDeleteMessageResponse = MessageResponse;

type AdminBulkDeleteMessagesResponse = {
  message: string;
  deletedCount: number;
};

type AdminArchiveChatResponse = MessageResponse;

// -----------------------------------------------------------------------------
// Admin Support
// -----------------------------------------------------------------------------

type AdminSupportTicket = {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  attachments?: string[];
  responses?: AdminSupportTicketResponse[];
  assignedToAdminId?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  resolvedAt?: ISODateString;
  closedAt?: ISODateString;
};

type AdminSupportTicketResponse = {
  id: string;
  ticketId: string;
  responderId: string;
  isFromAdmin: boolean;
  message: string;
  attachments?: string[];
  createdAt: ISODateString;
};

type AdminSupportTicketsListResponse = Paginated<AdminSupportTicket>;

type AdminSupportTicketDetailsResponse = AdminSupportTicket;

type AdminSupportReplyResponse = {
  message: string;
  responseId: string;
};

type AdminSupportStatisticsResponse = {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResolutionTime?: number;
  satisfactionScore?: number;
  ticketsByCategory?: Record<TicketCategory, number>;
  ticketsByPriority?: Record<TicketPriority, number>;
  ticketsByStatus?: Record<TicketStatus, number>;
};

type AdminSupportMutationResponse = MessageResponse;

// -----------------------------------------------------------------------------
// Admin Notifications
// -----------------------------------------------------------------------------

type AdminNotificationResponse = {
  id: string;
  templateId?: string;
  userId?: string;
  channel: NotificationChannel;
  target: NotificationTarget;
  status: NotificationStatus;
  message?: string;
  sent_at?: ISODateString;
  error_message?: string;
  created_at: ISODateString;
};

type AdminNotificationTemplateResponse = {
  id: string;
  name: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  variables?: Record<string, string>;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
};

type AdminNotificationLogsResponse = Paginated<{
  id: string;
  templateId?: string;
  userId?: string;
  channel: NotificationChannel;
  target: NotificationTarget;
  status: NotificationStatus;
  message?: string;
  variables?: Record<string, unknown>;
  error_message?: string;
  sent_at?: ISODateString;
  created_at: ISODateString;
}>;

type AdminNotificationStatsSummaryResponse = {
  totalNotificationsSent: number;
  totalNotificationsSuccessful: number;
  totalNotificationsFailed: number;
  successRate: number;
  topTemplates: {
    templateName: string;
    count: number;
    successRate: number;
  }[];
  topChannels: {
    channel: NotificationChannel;
    count: number;
    successRate: number;
  }[];
};

type AdminSendNotificationResponse = AdminNotificationResponse;
type AdminSendBulkNotificationsResponse = AdminNotificationResponse;
type AdminCreateNotificationTemplateResponse = AdminNotificationTemplateResponse;
type AdminUpdateNotificationTemplateResponse = AdminNotificationTemplateResponse;
type AdminDeleteNotificationTemplateResponse = MessageResponse;

// -----------------------------------------------------------------------------
// Admin Payments / Revenue / Refunds / Subscriptions / Wallet
// -----------------------------------------------------------------------------

type AdminTransactionDetailsResponse = {
  id: string;
  amount: number;
  fee?: number;
  type: string;
  description?: string;
  status: TransactionStatus;
  currency: string;
  payment_link?: string;
  provider_ref?: string;
  userId: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  user?: {
    id: string;
    email: string;
    username: string;
  };
  refunds?: unknown[];
};

type AdminTransactionsListResponse = Paginated<AdminTransactionDetailsResponse>;

type AdminDuplicateTransactionsResponse = {
  transactions: AdminTransactionDetailsResponse[];
  similarityScore: number;
  duplicateType: 'identical' | 'similar';
};

type AdminSubscriptionDetailsResponse = {
  id: string;
  userId: string;
  plan_name: string;
  amount: number;
  status: SubscriptionStatus;
  start_at?: ISODateString;
  end_at?: ISODateString;
  auto_renew: boolean;
  provider_ref?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
};

type AdminSubscriptionsListResponse = Paginated<AdminSubscriptionDetailsResponse>;
type AdminUserSubscriptionsResponse = AdminSubscriptionDetailsResponse[];

type AdminRefundDetailsResponse = {
  id: string;
  transactionId: string;
  requesterId?: string;
  amount: number;
  reason?: string;
  status: RefundStatus;
  processed_at?: ISODateString;
  failure_reason?: string;
  created_at: ISODateString;
};

type AdminRefundsListResponse = Paginated<AdminRefundDetailsResponse>;
type AdminCreateRefundResponse = MessageResponse;

type AdminWalletDetailsResponse = {
  id: string;
  balance: number;
  currency: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  recentTransactions?: AdminTransactionDetailsResponse[];
};

type AdminRevenueMetricResponse = {
  period: string;
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageTransactionValue: number;
  subscriptionRevenue: number;
  refundedAmount: number;
  netRevenue: number;
};

type AdminRevenueAnalyticsResponse = AdminRevenueMetricResponse[];

type AdminRevenueSummaryResponse = {
  totalTransactions: number;
  totalRevenue: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  activeSubscriptions: number;
  pendingRefunds: number;
  totalRefunded: number;
  averageTransactionValue: number;
};

// -----------------------------------------------------------------------------
// Admin Analytics
// -----------------------------------------------------------------------------

type AdminUserMetricsResponse = Array<{
  period: string;
  newUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  deletedUsers: number;
  bannedUsers: number;
  suspendedUsers: number;
}>;

type AdminRetentionMetricsResponse = Array<{
  period: string;
  totalUsers: number;
  retentionRate: number;
  churnRate: number;
  returningUsers: number;
}>;

type AdminEngagementMetricsResponse = Array<{
  period: string;
  matchesCount: number;
  messagesSent: number;
  messagesReceived: number;
  postsCreated: number;
  postsLiked: number;
  commentsCreated: number;
  averageEngagementPerUser: number;
  totalEngagementScore: number;
}>;

type AdminConversionMetricsResponse = Array<{
  period: string;
  freeToPaidRate: number;
  freeUsers: number;
  paidUsers: number;
  totalConversions: number;
  conversionValue: number;
  subscriptionConversionRate: number;
}>;

type AdminPanicMetricsResponse = {
  period: string;
  totalAlerts: number;
  resolvedAlerts: number;
  unResolvedAlerts: number;
  avgResolutionTime: number;
  alertsByHour: { hour: number; count: number }[];
  topLocations: { location: string; count: number }[];
  responseRate: number;
};

type AdminGeographicMetricsResponse = Array<{
  country: string;
  city?: string;
  userCount: number;
  activeUserCount: number;
  engagementScore: number;
  averageSessionDuration: number;
  conversionRate: number;
}>;

type AdminAnalyticsSummaryResponse = {
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
};

// -----------------------------------------------------------------------------
// Endpoint -> Response map (all current admin endpoints)
// -----------------------------------------------------------------------------

type AdminEndpointResponseMap = {
  // Admin auth
  'POST /admin/auth/login': AdminAuthLoginResponse;
  'POST /admin/auth/create-user': AdminAuthCreateUserResponse;
  'POST /admin/auth/logout': AdminAuthLogoutResponse;

  // Users
  'GET /admin/users': AdminUsersListResponse;
  'GET /admin/users/dashboard-stats': AdminDashboardStatsResponse;
  'GET /admin/users/:id': AdminUserDetailsResponse;
  'PATCH /admin/users/:id/suspend': AdminUserMutationResponse;
  'PATCH /admin/users/:id/ban': AdminUserMutationResponse;
  'PATCH /admin/users/:id/reactivate': AdminUserMutationResponse;
  'DELETE /admin/users/:id': AdminUserMutationResponse;
  'DELETE /admin/users/:id/permanent': AdminUserMutationResponse;
  'GET /admin/users/:id/sessions': AdminSessionsResponse;
  'GET /admin/users/:id/devices': AdminDevicesResponse;
  'GET /admin/users/:id/linked-accounts': AdminLinkedAccountsResponse;
  'PATCH /admin/users/:id/email': AdminUserMutationResponse;
  'PATCH /admin/users/:id/name': AdminUserMutationResponse;
  'PATCH /admin/users/:id/password': AdminUserMutationResponse;
  'PATCH /admin/users/:id/profile-details': AdminUserMutationResponse;
  'GET /admin/users/:id/security-profile': AdminUserSecurityProfileResponse;
  'POST /admin/users/:id/2fa/enable': AdminUserMutationResponse;
  'POST /admin/users/:id/2fa/disable': AdminUserMutationResponse;
  'GET /admin/users/:id/2fa/status': Admin2faStatusResponse;
  'POST /admin/users/:id/send-reactivation-notification': AdminUserMutationResponse;

  // Verifications
  'GET /admin/verifications': AdminVerificationsListResponse;
  'PATCH /admin/verifications/:id/approve': AdminUserMutationResponse;
  'PATCH /admin/verifications/:id/reject': AdminUserMutationResponse;

  // Chats
  'GET /admin/chats': AdminChatsListResponse;
  'GET /admin/chats/statistics': AdminChatStatisticsResponse;
  'GET /admin/chats/:chatId/messages': AdminChatMessagesResponse;
  'DELETE /admin/chats/messages/:messageId': AdminDeleteMessageResponse;
  'POST /admin/chats/messages/bulk-delete': AdminBulkDeleteMessagesResponse;
  'PATCH /admin/chats/:chatId/archive': AdminArchiveChatResponse;
  'GET /admin/chats/user/:userId/statistics': AdminUserMessageStatisticsResponse;

  // Support
  'GET /admin/support/tickets': AdminSupportTicketsListResponse;
  'GET /admin/support/tickets/:id': AdminSupportTicketDetailsResponse;
  'PATCH /admin/support/tickets/:id/status': AdminSupportMutationResponse;
  'PATCH /admin/support/tickets/:id/priority': AdminSupportMutationResponse;
  'PATCH /admin/support/tickets/:id/assign': AdminSupportMutationResponse;
  'POST /admin/support/tickets/:id/reply': AdminSupportReplyResponse;
  'PATCH /admin/support/tickets/:id/close': AdminSupportMutationResponse;
  'GET /admin/support/statistics': AdminSupportStatisticsResponse;

  // Notifications
  'POST /admin/notifications/send': AdminSendNotificationResponse;
  'POST /admin/notifications/send-bulk': AdminSendBulkNotificationsResponse;
  'GET /admin/notifications/templates': AdminNotificationTemplateResponse[];
  'POST /admin/notifications/templates': AdminCreateNotificationTemplateResponse;
  'PATCH /admin/notifications/templates/:id': AdminUpdateNotificationTemplateResponse;
  'DELETE /admin/notifications/templates/:id': AdminDeleteNotificationTemplateResponse;
  'GET /admin/notifications/logs': AdminNotificationLogsResponse;
  'GET /admin/notifications/stats': AdminNotificationStatsSummaryResponse;

  // Transactions / subscriptions / refunds / wallets / revenue
  'GET /admin/transactions': AdminTransactionsListResponse;
  'GET /admin/transactions/:id': AdminTransactionDetailsResponse;
  'GET /admin/transactions/duplicates': AdminDuplicateTransactionsResponse;
  'GET /admin/subscriptions': AdminSubscriptionsListResponse;
  'GET /admin/subscriptions/:userId': AdminUserSubscriptionsResponse;
  'GET /admin/refunds': AdminRefundsListResponse;
  'POST /admin/refunds/:transactionId': AdminCreateRefundResponse;
  'GET /admin/wallets/:userId': AdminWalletDetailsResponse;
  'GET /admin/revenue/analytics': AdminRevenueAnalyticsResponse;
  'GET /admin/revenue/summary': AdminRevenueSummaryResponse;

  // Analytics
  'GET /admin/analytics/users': AdminUserMetricsResponse;
  'GET /admin/analytics/users/retention': AdminRetentionMetricsResponse;
  'GET /admin/analytics/engagement': AdminEngagementMetricsResponse;
  'GET /admin/analytics/conversion': AdminConversionMetricsResponse;
  'GET /admin/analytics/panic': AdminPanicMetricsResponse;
  'GET /admin/analytics/geography': AdminGeographicMetricsResponse;
  'GET /admin/analytics/summary': AdminAnalyticsSummaryResponse;
};
```

Notes:
- Types mirror current controller/service behavior and existing admin DTOs.
- Some endpoints currently have runtime fallbacks (for preview resilience), but response contracts above reflect the intended stable shapes.
- You can copy the TypeScript block into frontend/shared types and split by module as needed.
