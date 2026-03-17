import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/** Amount in currency subunit (kobo for NGN, cents for USD). */
export interface PaystackInitializeInput {
  email: string;
  amount: number; // in main unit (e.g. USD 10); service converts to subunit
  currency?: string;
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    currency: string;
  };
}

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly api: AxiosInstance;

  constructor() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey || ''}`,
      },
    });
  }

  /**
   * Initialize a Paystack transaction. Returns the URL to redirect the user to.
   * Amount is in main unit (e.g. 10 for $10); converted to subunit (cents) for Paystack.
   */
  async initializeTransaction(params: PaystackInitializeInput) {
    const amountInSubunit = Math.round(params.amount * 100); // USD: cents; NGN: kobo
    const callbackUrl =
      params.callback_url ||
      `${process.env.BASE_URL || ''}/wallet/callback`;

    try {
      const response = await this.api.post<PaystackInitializeResponse>(
        '/transaction/initialize',
        {
          email: params.email,
          amount: amountInSubunit,
          currency: params.currency || 'USD',
          reference: params.reference,
          callback_url: callbackUrl,
          metadata: params.metadata,
        },
      );

      const data = response.data?.data;
      if (!response.data?.status || !data?.authorization_url) {
        return null;
      }

      return {
        authorization_url: data.authorization_url,
        access_code: data.access_code,
        reference: data.reference,
      };
    } catch {
      return null;
    }
  }

  /**
   * Verify a Paystack transaction by reference.
   */
  async verifyTransaction(reference: string): Promise<boolean> {
    try {
      const response = await this.api.get<PaystackVerifyResponse>(
        `/transaction/verify/${encodeURIComponent(reference)}`,
      );

      const data = response.data?.data;
      if (!response.data?.status || !data) {
        return false;
      }

      return data.status === 'success';
    } catch {
      return false;
    }
  }
}
