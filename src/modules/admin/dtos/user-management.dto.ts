import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import {
  user_account_status,
  verification_status,
  admin_role,
} from '@prisma/client';

// User Listing DTOs
export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(user_account_status)
  status?: user_account_status;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string; // email, name
}

// User Details Response DTO
export class UserDetailsResponseDto {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  bio?: string;
  phone_number?: string;
  country?: string;
  account_status: user_account_status;
  is_verified: boolean;
  is_flagged: boolean;
  banned_at?: Date;
  suspended_at?: Date;
  last_login_at?: Date;
  created_at: Date;
  profile?: {
    bio?: string;
    photos?: any[];
    preferences?: any;
  };
  activityMetrics?: {
    lastLogin?: Date;
    matchesCount?: number;
    chatsCount?: number;
    postsCount?: number;
  };
}

// Account Actions DTOs
export class SuspendUserDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsInt()
  duration?: number; // in days, optional for permanent suspension
}

export class BanUserDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  ban_reason_details?: string;
}

export class ReactivateUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeleteUserDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}

// KYC Management DTOs
export class ListVerificationsQueryDto {
  @IsOptional()
  @IsEnum(verification_status)
  status?: verification_status;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ApproveVerificationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectVerificationDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}

// Session & Device DTOs
export class SessionDetailsDto {
  id: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  revoked_at?: Date;
  last_seen_at?: Date;
  created_at: Date;
}

export class DeviceDetailsDto {
  id: string;
  device_id: string;
  platform?: string;
  os_version?: string;
  app_version?: string;
  ip_address?: string;
  last_seen_at?: Date;
  created_at: Date;
}

export class LinkedAccountDto {
  sourceUserId: string;
  targetUserId: string;
  reason?: string;
  confidence_score?: number;
  created_at: Date;
}

// Pagination Response DTO
export class PaginatedResponseDto<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Admin Dashboard Stats DTO
export class AdminDashboardStatsDto {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  verifiedUsers: number;
  flaggedUsers: number;
  pendingVerifications: number;
  newUsersThisMonth: number;
  newUsersThisWeek: number;
}

// Profile Update DTOs
export class ResetUserEmailDto {
  @IsEmail()
  newEmail: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResetUserNameDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResetUserPasswordDto {
  @IsString()
  newPassword: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResetProfileDetailsDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// 2FA Management DTOs
export class Enable2faDto {
  @IsOptional()
  @IsString()
  method?: '2fa_email' | '2fa_sms' | '2fa_authenticator'; // default: email

  @IsOptional()
  @IsString()
  notes?: string;
}

export class Disable2faDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class TwoFactorStatusDto {
  userId: string;
  is2faEnabled: boolean;
  twoFactorMethod?: '2fa_email' | '2fa_sms' | '2fa_authenticator';
  enabledAt?: Date;
  lastUsedAt?: Date;
}

// Account Reactivation Notification DTO
export class SendAccountReactivationNotificationDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  channel?: 'email' | 'sms' | 'both';
}

// User Profile Response with all details
export class UserProfileWithSecurityDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber?: string;
  country?: string;
  city?: string;
  bio?: string;
  accountStatus: user_account_status;
  isVerified: boolean;
  is2faEnabled: boolean;
  twoFactorMethod?: '2fa_email' | '2fa_sms' | '2fa_authenticator';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  bannedAt?: Date;
}
