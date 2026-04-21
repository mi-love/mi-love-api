import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { admin_role } from '@prisma/client';

export interface AdminRoleOptions {
  roles?: admin_role[];
  requireAdmin?: boolean;
}

@Injectable()
export class AdminRoleGuard implements CanActivate {
  private options: AdminRoleOptions;

  constructor(@Optional() options?: AdminRoleOptions) {
    this.options = options || {};
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user is authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Support both legacy and newer schemas:
    // - legacy: user.is_admin boolean
    // - newer: admin role presence implies admin access
    const isAdmin =
      Boolean(user?.is_admin) ||
      (typeof user?.admin_role === 'string' && user.admin_role.length > 0);

    if (!isAdmin) {
      throw new ForbiddenException('User is not an admin');
    }

    // Check specific roles if required
    if (this.options.roles && this.options.roles.length > 0) {
      if (!this.options.roles.includes(user.admin_role)) {
        throw new ForbiddenException(
          `Admin role ${user.admin_role} is not authorized for this action. Required: ${this.options.roles.join(', ')}`,
        );
      }
    }

    return true;
  }
}

// Factory function to create role-specific guards
export function AdminRole(roles?: admin_role[]) {
  @Injectable()
  class AdminRoleGuardWithRoles extends AdminRoleGuard {
    constructor() {
      super({ roles });
    }
  }

  return AdminRoleGuardWithRoles;
}
