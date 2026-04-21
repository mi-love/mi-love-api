import { DbService } from '@/database/database.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException({
        message: 'No token provided',
      });
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException({
        message: 'Invalid token',
      });
    }

    if (!payload?.sub) {
      throw new UnauthorizedException({
        message: 'Invalid token',
      });
    }

    let user: any = null;

    try {
      user = await this.db.user.findUnique({
        where: {
          id: payload?.sub,
        },
        select: {
          id: true,
          email: true,
          username: true,
          first_name: true,
          last_name: true,
          admin_role: true,
        },
      });
    } catch {
      user = null;
    }

    if (!user) {
      user = {
        id: payload.sub,
        email: payload.email,
      };
    }

    request['user'] = {
      ...user,
      // Token claims can help admin preview flows when DB role columns are unavailable.
      is_admin: Boolean(payload?.is_admin),
      admin_role: payload?.admin_role || user?.admin_role,
    };

    if (!request['user']?.id) {
      throw new UnauthorizedException({
        message: 'Invalid token',
      });
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authorizationHeader =
      (request.headers.authorization as string | undefined) ||
      (request.headers.Authorization as string | undefined);

    const xAccessToken = request.headers['x-access-token'];
    const tokenHeader = request.headers['token'];

    const extractFromValue = (value?: string | string[]): string | null => {
      if (!value) return null;
      const tokenValue = Array.isArray(value) ? value[0] : value;
      const trimmed = String(tokenValue).trim();
      if (!trimmed) return null;

      if (/^Bearer\s+/i.test(trimmed)) {
        return trimmed.replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '').trim();
      }

      // Allow raw token values for preview clients that do not prepend "Bearer "
      return trimmed.replace(/^"|"$/g, '').trim();
    };

    return (
      extractFromValue(authorizationHeader) ||
      extractFromValue(xAccessToken) ||
      extractFromValue(tokenHeader)
    );
  }
}
