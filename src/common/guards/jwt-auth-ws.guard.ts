import { DbService } from '@/database/database.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { extractSocketToken } from '@/common/utils/socket-auth';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = extractSocketToken(client);
    if (!token) {
      throw new UnauthorizedException({
        message: 'Token not found',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });
      const user = await this.db.user.findUnique({
        where: {
          id: payload?.sub,
        },
        include: {
          wallet: true,
          profile_picture: true,
        },
      });
      if (!user) {
        throw new UnauthorizedException({ message: 'User not found' });
      }
      client.data.user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        message: 'Invalid token',
      });
    }
  }
}
