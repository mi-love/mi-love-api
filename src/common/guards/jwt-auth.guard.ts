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

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.db.user.findUnique({
        where: {
          id: payload?.sub,
        },
        include: {
          profile_picture: {
            select: {
              url: true,
              provider: true,
            },
          },
          interests: {
            take: 15,
          },
        },

        omit: {
          password: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          message: 'Invalid token',
        });
      }
      request['user'] = user;
    } catch {
      throw new UnauthorizedException({
        message: 'Invalid token',
      });
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
