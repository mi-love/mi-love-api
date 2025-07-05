import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class MailService {
  private api: AxiosInstance;
  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.useplunk.com/v1',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PLUNK_API_KEY}`,
      },
    });
  }

  async sendEmail({ to, subject, body }: SendEmailParams) {
    try {
      await this.api.post('/send', {
        to,
        subject,
        body,
      });
      console.log('[✅]', 'Email sent successfully');
    } catch {
      console.log('[‼️]', 'Failed to send email');
    }
  }
}
