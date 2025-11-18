import { UserWithoutPassword } from '@/common/types/db';
import { DbService } from '@/database/database.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { StreamClient } from '@stream-io/node-sdk';

@Injectable()
export class StreamService implements OnModuleInit {
  private client: StreamClient;

  async onModuleInit() {
    try {
      this.client = new StreamClient(
        process.env.STREAM_API_KEY!,
        process.env.STREAM_API_SECRET!,
      );
    } catch (error) {
      console.log(error, 'Failed to initize Stream client');
    }
  }

  constructor(private readonly db: DbService) {}

  async getToken(user: UserWithoutPassword) {
    const token = this.client.generateCallToken({
      user_id: user.id,
      call_cids: [],
    });
    return {
      message: 'Call Streams Token Generate Successfully',
      token,
    };
  }
}
