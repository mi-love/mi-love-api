import { DbService } from '@/database/database.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractTokenFromHeader(client);
    console.log(token);
    if (!token) {
      throw new UnauthorizedException({
        message: 'Token not found',
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
          wallet: true,
        },
      });
      client.data.user = user;
      return true;
    } catch {
      throw new UnauthorizedException({
        message: 'Invalid token',
      });
    }
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const [type, token] =
      client.handshake.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
