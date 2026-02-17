import { Injectable } from '@nestjs/common';
import * as twilio from 'twilio';

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
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';

    this.client = twilio.default(accountSid, authToken);
  }

  async sendMessage({
    to,
    message,
    type,
    location,
  }: SendMessageParams) {
    try {
      // Format phone number for WhatsApp
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      if (type === 'location' && location) {
        // Send location message
        const response = await this.client.messages.create({
          from: this.fromNumber,
          to: formattedTo,
          body: message,
          persistentAction: [`geo:${location.latitude},${location.longitude}`],
        });

        return {
          status: 200,
          data: {
            messages: [{ id: response.sid }],
            sid: response.sid,
          },
        };
      } else {
        // Send text message
        const response = await this.client.messages.create({
          from: this.fromNumber,
          to: formattedTo,
          body: message,
        });

        return {
          status: 200,
          data: {
            messages: [{ id: response.sid }],
            sid: response.sid,
          },
        };
      }
    } catch (error: any) {
      console.error('Twilio WhatsApp Error:', error);
      return {
        status: error.status || 400,
        error: error.message || 'Failed to send WhatsApp message',
      };
    }
  }
}
