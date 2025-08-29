import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance, isAxiosError } from 'axios';

interface SendMessageParams {
  to: string;
  message: string;
  type: 'text' | 'interactive' | 'location';
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  actions?: {
    buttons: {
      type: string;
      reply: {
        id: string;
        title: string;
      };
    }[];
  };

  context?: {
    message_id: string;
  };
}

@Injectable()
export class WhatsappService {
  api: AxiosInstance;
  constructor() {
    this.api = axios.create({
      baseURL: '  https://graph.facebook.com/v22.0/115513451410785',
      headers: {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN ?? ''}`,
      },
    });
  }

  async sendMessage({
    to,
    message,
    actions,
    type,
    location,
    context,
  }: SendMessageParams) {
    try {
      const response = await this.api.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type,
        context,
        interactive:
          type === 'interactive'
            ? {
                type: 'button',
                body: {
                  text: message,
                },
                action: actions,
              }
            : undefined,
        text:
          type === 'text' ? { body: message, preview_url: true } : undefined,

        location:
          type === 'location'
            ? { latitude: location?.latitude, longitude: location?.longitude }
            : undefined,
      });

      return {
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      if (isAxiosError(error)) {
        return {
          status: error.response?.status,
          error: error.response?.data,
        };
      }
      return {
        status: 400,
        error: 'Internet Connection Error',
      };
    }
  }
}
