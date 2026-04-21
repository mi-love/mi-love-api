import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../../common/guards/admin-role.guard';
import { User } from '../../../common/decorator/user.decorator';
import { AdminUserManagementService } from '../services/user-management.service';
import {
  ListUsersQueryDto,
  SuspendUserDto,
  BanUserDto,
  ReactivateUserDto,
  DeleteUserDto,
  ListVerificationsQueryDto,
  ApproveVerificationDto,
  RejectVerificationDto,
  ResetUserEmailDto,
  ResetUserNameDto,
  ResetUserPasswordDto,
  ResetProfileDetailsDto,
  Enable2faDto,
  Disable2faDto,
  SendAccountReactivationNotificationDto,
} from '../dtos/user-management.dto';
import { admin_role } from '@prisma/client';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminUserManagementController {
  constructor(private userService: AdminUserManagementService) {}

  @Get()
  async listUsers(@Query() query: ListUsersQueryDto, @User() user: any) {
    return this.userService.listUsers(query, user.id);
  }

  @Get('dashboard-stats')
  async getDashboardStats(@User() user: any) {
    return this.userService.getAdminDashboardStats(user.id);
  }

  @Get(':id')
  async getUserDetails(@Param('id') userId: string, @User() user: any) {
    return this.userService.getUserDetails(userId, user.id);
  }

  @Patch(':id/suspend')
  async suspendUser(
    @Param('id') userId: string,
    @Body() data: SuspendUserDto,
    @User() user: any,
  ) {
    return this.userService.suspendUser(userId, data, user.id);
  }

  @Patch(':id/ban')
  async banUser(
    @Param('id') userId: string,
    @Body() data: BanUserDto,
    @User() user: any,
  ) {
    return this.userService.banUser(userId, data, user.id);
  }

  @Patch(':id/reactivate')
  async reactivateUser(
    @Param('id') userId: string,
    @Body() data: ReactivateUserDto,
    @User() user: any,
  ) {
    return this.userService.reactivateUser(userId, data, user.id);
  }

  @Delete(':id')
  async softDeleteUser(
    @Param('id') userId: string,
    @Body() data: DeleteUserDto,
    @User() user: any,
  ) {
    return this.userService.softDeleteUser(userId, data, user.id);
  }

  @Delete(':id/permanent')
  async permanentlyDeleteUser(
    @Param('id') userId: string,
    @Body() data: DeleteUserDto,
    @User() user: any,
  ) {
    return this.userService.permanentlyDeleteUser(userId, data, user.id);
  }

  @Get(':id/sessions')
  async getUserSessions(@Param('id') userId: string, @User() user: any) {
    return this.userService.getUserSessions(userId, user.id);
  }

  @Get(':id/devices')
  async getUserDevices(@Param('id') userId: string, @User() user: any) {
    return this.userService.getUserDevices(userId, user.id);
  }

  @Get(':id/linked-accounts')
  async getUserLinkedAccounts(@Param('id') userId: string, @User() user: any) {
    return this.userService.getUserLinkedAccounts(userId, user.id);
  }

  // Profile Update Endpoints
  @Patch(':id/email')
  async resetUserEmail(
    @Param('id') userId: string,
    @Body() data: ResetUserEmailDto,
    @User() user: any,
  ) {
    return this.userService.resetUserEmail(userId, data, user.id);
  }

  @Patch(':id/name')
  async resetUserName(
    @Param('id') userId: string,
    @Body() data: ResetUserNameDto,
    @User() user: any,
  ) {
    return this.userService.resetUserName(userId, data, user.id);
  }

  @Patch(':id/password')
  async resetUserPassword(
    @Param('id') userId: string,
    @Body() data: ResetUserPasswordDto,
    @User() user: any,
  ) {
    return this.userService.resetUserPassword(userId, data, user.id);
  }

  @Patch(':id/profile-details')
  async resetProfileDetails(
    @Param('id') userId: string,
    @Body() data: ResetProfileDetailsDto,
    @User() user: any,
  ) {
    return this.userService.resetProfileDetails(userId, data, user.id);
  }

  @Get(':id/security-profile')
  async getUserSecurityProfile(@Param('id') userId: string, @User() user: any) {
    return this.userService.getUserProfileWithSecurity(userId, user.id);
  }

  // 2FA Management Endpoints
  @Post(':id/2fa/enable')
  async enable2fa(
    @Param('id') userId: string,
    @Body() data: Enable2faDto,
    @User() user: any,
  ) {
    return this.userService.enable2fa(userId, data, user.id);
  }

  @Post(':id/2fa/disable')
  async disable2fa(
    @Param('id') userId: string,
    @Body() data: Disable2faDto,
    @User() user: any,
  ) {
    return this.userService.disable2fa(userId, data, user.id);
  }

  @Get(':id/2fa/status')
  async get2faStatus(@Param('id') userId: string, @User() user: any) {
    return this.userService.get2faStatus(userId, user.id);
  }

  // Account Reactivation Endpoint
  @Post(':id/send-reactivation-notification')
  async sendReactivationNotification(
    @Param('id') userId: string,
    @Body() data: SendAccountReactivationNotificationDto,
    @User() user: any,
  ) {
    return this.userService.sendAccountReactivationNotification(userId, data, user.id);
  }
}

@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminVerificationController {
  constructor(private userService: AdminUserManagementService) {}

  @Get()
  async listVerifications(
    @Query() query: ListVerificationsQueryDto,
    @User() user: any,
  ) {
    return this.userService.listVerifications(query, user.id);
  }

  @Patch(':id/approve')
  async approveVerification(
    @Param('id') verificationId: string,
    @Body() data: ApproveVerificationDto,
    @User() user: any,
  ) {
    return this.userService.approveVerification(verificationId, data, user.id);
  }

  @Patch(':id/reject')
  async rejectVerification(
    @Param('id') verificationId: string,
    @Body() data: RejectVerificationDto,
    @User() user: any,
  ) {
    return this.userService.rejectVerification(verificationId, data, user.id);
  }
}
