import { BadGatewayException, Injectable } from '@nestjs/common';
import { SendMessageDto } from './chat.dto';

@Injectable()
export class ChatService {
  async sendMessage(userId: string, body: SendMessageDto) {
    const { message, fileId } = body;

    if (!message && !fileId) {
      throw new BadGatewayException({
        message: 'No message or fileId provided',
      });
    }
  }
}
