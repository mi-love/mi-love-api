import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsAuthGuard } from '@/common/guards/jwt-auth-ws.guard';
import { DbService } from '@/database/database.service';
@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private db: DbService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractTokenFromHeader(client);

      if (!token) {
        client.disconnect();
        return;
      }

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
      console.log('> Connected client:', client.id, user?.email);
    } catch {
      console.log('> Authentication failed for client:', client.id);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user;
    console.log('> Disconnected client:', client.id, user.email);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('customName')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: any,
  ): void {
    const user = client.data.user;
    this.server.emit('room', `[${user?.username || client.id}] -> ${message}`);
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const [type, token] =
      client.handshake.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
