import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  ListUsersQueryDto,
  UserDetailsResponseDto,
  SuspendUserDto,
  BanUserDto,
  ReactivateUserDto,
  DeleteUserDto,
  ListVerificationsQueryDto,
  ApproveVerificationDto,
  RejectVerificationDto,
  PaginatedResponseDto,
  AdminDashboardStatsDto,
  ResetUserEmailDto,
  ResetUserNameDto,
  ResetUserPasswordDto,
  ResetProfileDetailsDto,
  Enable2faDto,
  Disable2faDto,
  TwoFactorStatusDto,
  SendAccountReactivationNotificationDto,
  UserProfileWithSecurityDto,
} from '../dtos/user-management.dto';
import { user_account_status, verification_status } from '@prisma/client';

@Injectable()
export class AdminUserManagementService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async listUsers(
    query: ListUsersQueryDto,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const { status, page = 1, limit = 20, search } = query;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.account_status = status;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          username: true,
          account_status: true,
          is_verified: true,
          is_flagged: true,
          banned_at: true,
          suspended_at: true,
          created_at: true,
          last_login_at: true,
        },
        orderBy: { created_at: 'desc' },
      }),
      this.db.user.count({ where }),
    ]);

    this.logger.log(`Listed ${users.length} users`, 'AdminUserManagementService');

    return {
      data: users,
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

  async getUserDetails(
    userId: string,
    adminId: string,
  ): Promise<UserDetailsResponseDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        posts: true,
        transaction: true,
        participant: {
          include: { chat: { include: { messages: true } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Count activity metrics
    const matchesCount = user.my_friends?.length || 0;
    const chatsCount = user.participant?.length || 0;
    const postsCount = user.posts?.length || 0;

    this.logger.log(`Retrieved user details for ${userId}`, 'AdminUserManagementService');

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      bio: user.bio,
      phone_number: user.phone_number,
      country: user.country,
      account_status: user.account_status,
      is_verified: user.is_verified,
      is_flagged: user.is_flagged,
      banned_at: user.banned_at,
      suspended_at: user.suspended_at,
      created_at: user.created_at,
      profile: user.profile
        ? {
            bio: user.profile.bio,
            photos: user.profile.photos,
            preferences: user.profile.preferences,
          }
        : undefined,
      activityMetrics: {
        lastLogin: user.last_login_at,
        matchesCount,
        chatsCount,
        postsCount,
      },
    };
  }

  async suspendUser(
    userId: string,
    data: SuspendUserDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.account_status === user_account_status.suspended) {
      throw new ConflictException('User is already suspended');
    }

    await this.db.user.update({
      where: { id: userId },
      data: {
        account_status: user_account_status.suspended,
        suspended_at: new Date(),
      },
    });

    // Log admin action
    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'SUSPEND_USER',
        resource: 'user',
        resource_id: userId,
        metadata: { reason: data.reason, duration: data.duration },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'SUSPEND_USER',
      'user',
      userId,
      data,
    );

    return { message: `User ${userId} has been suspended` };
  }

  async banUser(
    userId: string,
    data: BanUserDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.account_status === user_account_status.banned) {
      throw new ConflictException('User is already banned');
    }

    await this.db.user.update({
      where: { id: userId },
      data: {
        account_status: user_account_status.banned,
        banned_at: new Date(),
      },
    });

    // Log admin action
    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'BAN_USER',
        resource: 'user',
        resource_id: userId,
        metadata: data,
      },
    });

    this.logger.logAdminAction(adminId, 'BAN_USER', 'user', userId, data);

    return { message: `User ${userId} has been banned` };
  }

  async reactivateUser(
    userId: string,
    data: ReactivateUserDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.account_status === user_account_status.active) {
      throw new ConflictException('User is already active');
    }

    await this.db.user.update({
      where: { id: userId },
      data: {
        account_status: user_account_status.active,
        suspended_at: null,
        banned_at: null,
      },
    });

    // Log admin action
    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'REACTIVATE_USER',
        resource: 'user',
        resource_id: userId,
        metadata: data,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'REACTIVATE_USER',
      'user',
      userId,
      data,
    );

    return { message: `User ${userId} has been reactivated` };
  }

  async softDeleteUser(
    userId: string,
    data: DeleteUserDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.db.user.update({
      where: { id: userId },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_reason: data.reason,
        account_status: user_account_status.deleted,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'SOFT_DELETE_USER',
        resource: 'user',
        resource_id: userId,
        metadata: data,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'SOFT_DELETE_USER',
      'user',
      userId,
      data,
    );

    return { message: `User ${userId} has been soft-deleted` };
  }

  async permanentlyDeleteUser(
    userId: string,
    data: DeleteUserDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // This would require cascading deletes
    // Be very careful with this operation
    await this.db.user.delete({ where: { id: userId } });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'PERMANENT_DELETE_USER',
        resource: 'user',
        resource_id: userId,
        metadata: data,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'PERMANENT_DELETE_USER',
      'user',
      userId,
      data,
    );

    return { message: `User ${userId} has been permanently deleted` };
  }

  // KYC Management
  async listVerifications(
    query: ListVerificationsQueryDto,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const { status, page = 1, limit = 20 } = query;

    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [verifications, total] = await Promise.all([
      this.db.verification.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, email: true, username: true } } },
        orderBy: { created_at: 'desc' },
      }),
      this.db.verification.count({ where }),
    ]);

    this.logger.log(
      `Listed ${verifications.length} verifications`,
      'AdminUserManagementService',
    );

    return {
      data: verifications,
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

  async approveVerification(
    verificationId: string,
    data: ApproveVerificationDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const verification = await this.db.verification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException(`Verification ${verificationId} not found`);
    }

    if (verification.status !== verification_status.pending) {
      throw new ConflictException('Verification is not pending');
    }

    await this.db.verification.update({
      where: { id: verificationId },
      data: {
        status: verification_status.approved,
        reviewed_by: adminId,
        reviewed_at: new Date(),
      },
    });

    // Update user verification status
    await this.db.user.update({
      where: { id: verification.userId },
      data: { is_verified: true },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'APPROVE_VERIFICATION',
        resource: 'verification',
        resource_id: verificationId,
        metadata: data,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'APPROVE_VERIFICATION',
      'verification',
      verificationId,
      data,
    );

    return { message: `Verification ${verificationId} has been approved` };
  }

  async rejectVerification(
    verificationId: string,
    data: RejectVerificationDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const verification = await this.db.verification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException(`Verification ${verificationId} not found`);
    }

    if (verification.status !== verification_status.pending) {
      throw new ConflictException('Verification is not pending');
    }

    await this.db.verification.update({
      where: { id: verificationId },
      data: {
        status: verification_status.rejected,
        reviewed_by: adminId,
        reviewed_at: new Date(),
        reason: data.reason,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'REJECT_VERIFICATION',
        resource: 'verification',
        resource_id: verificationId,
        metadata: data,
      },
    });

    this.logger.logAdminAction(
      adminId,
      'REJECT_VERIFICATION',
      'verification',
      verificationId,
      data,
    );

    return { message: `Verification ${verificationId} has been rejected` };
  }

  // Sessions & Devices
  async getUserSessions(
    userId: string,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const sessions = await this.db.session.findMany({
      where: { userId },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const total = await this.db.session.count({ where: { userId } });

    this.logger.log(
      `Retrieved ${sessions.length} sessions for user ${userId}`,
      'AdminUserManagementService',
    );

    return {
      data: sessions,
      pagination: {
        page: 1,
        limit: 20,
        total,
        totalPages: Math.ceil(total / 20),
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  async getUserDevices(
    userId: string,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const devices = await this.db.device.findMany({
      where: { userId },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const total = await this.db.device.count({ where: { userId } });

    this.logger.log(
      `Retrieved ${devices.length} devices for user ${userId}`,
      'AdminUserManagementService',
    );

    return {
      data: devices,
      pagination: {
        page: 1,
        limit: 20,
        total,
        totalPages: Math.ceil(total / 20),
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  async getUserLinkedAccounts(
    userId: string,
    adminId: string,
  ): Promise<PaginatedResponseDto<any>> {
    const linkedAccounts = await this.db.user_link.findMany({
      where: {
        OR: [{ sourceUserId: userId }, { targetUserId: userId }],
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const total = await this.db.user_link.count({
      where: {
        OR: [{ sourceUserId: userId }, { targetUserId: userId }],
      },
    });

    this.logger.log(
      `Retrieved ${linkedAccounts.length} linked accounts for user ${userId}`,
      'AdminUserManagementService',
    );

    return {
      data: linkedAccounts,
      pagination: {
        page: 1,
        limit: 20,
        total,
        totalPages: Math.ceil(total / 20),
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  // Admin Dashboard
  async getAdminDashboardStats(adminId: string): Promise<AdminDashboardStatsDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      verifiedUsers,
      flaggedUsers,
      pendingVerifications,
      newUsersThisMonth,
      newUsersThisWeek,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({
        where: { account_status: user_account_status.active },
      }),
      this.db.user.count({
        where: { account_status: user_account_status.suspended },
      }),
      this.db.user.count({
        where: { account_status: user_account_status.banned },
      }),
      this.db.user.count({ where: { is_verified: true } }),
      this.db.user.count({ where: { is_flagged: true } }),
      this.db.verification.count({
        where: { status: verification_status.pending },
      }),
      this.db.user.count({ where: { created_at: { gte: startOfMonth } } }),
      this.db.user.count({ where: { created_at: { gte: startOfWeek } } }),
    ]);

    this.logger.log(`Retrieved dashboard stats`, 'AdminUserManagementService');

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      verifiedUsers,
      flaggedUsers,
      pendingVerifications,
      newUsersThisMonth,
      newUsersThisWeek,
    };
  }

  // Profile Updates
  async resetUserEmail(
    userId: string,
    data: ResetUserEmailDto,
    adminId: string,
  ): Promise<{ message: string; newEmail: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Check if new email already exists
    const existingUser = await this.db.user.findUnique({
      where: { email: data.newEmail },
    });
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email already in use');
    }

    await this.db.user.update({
      where: { id: userId },
      data: { email: data.newEmail },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'RESET_USER_EMAIL',
        resource: 'user',
        resource_id: userId,
        metadata: { oldEmail: user.email, newEmail: data.newEmail, notes: data.notes },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'RESET_USER_EMAIL',
      'user',
      userId,
      data,
    );

    return { message: `Email updated for user ${userId}`, newEmail: data.newEmail };
  }

  async resetUserName(
    userId: string,
    data: ResetUserNameDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updateData: any = {};
    if (data.firstName) updateData.first_name = data.firstName;
    if (data.lastName) updateData.last_name = data.lastName;
    if (data.username) {
      // Check if username exists
      const existingUser = await this.db.user.findUnique({
        where: { username: data.username },
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Username already taken');
      }
      updateData.username = data.username;
    }

    await this.db.user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'RESET_USER_NAME',
        resource: 'user',
        resource_id: userId,
        metadata: { oldData: { firstName: user.first_name, lastName: user.last_name, username: user.username }, newData: updateData, notes: data.notes },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'RESET_USER_NAME',
      'user',
      userId,
      data,
    );

    return { message: `Name/username updated for user ${userId}` };
  }

  async resetUserPassword(
    userId: string,
    data: ResetUserPasswordDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // In production, you would hash the password using bcrypt
    // const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    
    await this.db.user.update({
      where: { id: userId },
      data: { password: data.newPassword }, // TODO: Hash password in production
    });

    // Invalidate all sessions for this user
    await this.db.session.deleteMany({
      where: { userId },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'RESET_USER_PASSWORD',
        resource: 'user',
        resource_id: userId,
        metadata: { notes: data.notes, sessionsRevoked: true },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'RESET_USER_PASSWORD',
      'user',
      userId,
      { notes: data.notes },
    );

    return { message: `Password reset for user ${userId}. All sessions invalidated.` };
  }

  async resetProfileDetails(
    userId: string,
    data: ResetProfileDetailsDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updateData: any = {};
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.city !== undefined) updateData.city = data.city;

    await this.db.user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'RESET_PROFILE_DETAILS',
        resource: 'user',
        resource_id: userId,
        metadata: { updates: updateData, notes: data.notes },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'RESET_PROFILE_DETAILS',
      'user',
      userId,
      data,
    );

    return { message: `Profile details updated for user ${userId}` };
  }

  // 2FA Management
  async enable2fa(
    userId: string,
    data: Enable2faDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const method = data.method || '2fa_email';

    await this.db.user.update({
      where: { id: userId },
      data: {
        is_2fa_enabled: true,
        two_factor_method: method as any,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'ENABLE_2FA',
        resource: 'user',
        resource_id: userId,
        metadata: { method, notes: data.notes },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'ENABLE_2FA',
      'user',
      userId,
      data,
    );

    return { message: `2FA enabled for user ${userId} with method: ${method}` };
  }

  async disable2fa(
    userId: string,
    data: Disable2faDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (!user.is_2fa_enabled) {
      throw new ConflictException('2FA is not enabled for this user');
    }

    await this.db.user.update({
      where: { id: userId },
      data: {
        is_2fa_enabled: false,
        two_factor_method: null,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'DISABLE_2FA',
        resource: 'user',
        resource_id: userId,
        metadata: { reason: data.reason, notes: data.notes },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'DISABLE_2FA',
      'user',
      userId,
      data,
    );

    return { message: `2FA disabled for user ${userId}` };
  }

  async get2faStatus(userId: string, adminId: string): Promise<TwoFactorStatusDto> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    this.logger.log(
      `Retrieved 2FA status for user ${userId}`,
      'AdminUserManagementService',
    );

    return {
      userId,
      is2faEnabled: user.is_2fa_enabled || false,
      twoFactorMethod: user.two_factor_method as any,
      enabledAt: user.updated_at,
      lastUsedAt: user.last_login_at,
    };
  }

  // Account Reactivation
  async sendAccountReactivationNotification(
    userId: string,
    data: SendAccountReactivationNotificationDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Create notification log entry
    await this.db.notification_log.create({
      data: {
        userId,
        channel: (data.channel === 'both' ? 'email' : data.channel) || 'email',
        status: 'sent',
        template_id: 'account_reactivated',
        subject: 'Account Reactivated',
        message: data.message || 'Your account has been reactivated by our team.',
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'SEND_REACTIVATION_NOTIFICATION',
        resource: 'user',
        resource_id: userId,
        metadata: { channel: data.channel, message: data.message },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'SEND_REACTIVATION_NOTIFICATION',
      'user',
      userId,
      data,
    );

    return { message: `Reactivation notification sent to user ${userId}` };
  }

  async getUserProfileWithSecurity(
    userId: string,
    adminId: string,
  ): Promise<UserProfileWithSecurityDto> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    this.logger.log(
      `Retrieved full profile with security for user ${userId}`,
      'AdminUserManagementService',
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      phoneNumber: user.phone_number,
      country: user.country,
      city: user.city,
      bio: user.bio,
      accountStatus: user.account_status,
      isVerified: user.is_verified,
      is2faEnabled: user.is_2fa_enabled || false,
      twoFactorMethod: user.two_factor_method as any,
      lastLogin: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      suspendedAt: user.suspended_at,
      bannedAt: user.banned_at,
    };
  }
}
