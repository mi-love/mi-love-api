import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/** Amount in USD; service converts to NGN using exchange rate for Paystack. */
export interface PaystackInitializeInput {
  email: string;
  amount: number; // amount in USD
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}

/** 1 USD = 1500 NGN. Paystack charges in Naira (NGN), amount in kobo. */
const USD_TO_NGN = 1500;
const NGN_TO_KOBO = 100;

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
   * Initialize a Paystack transaction in Naira (NGN).
   * Input amount is in USD; converted to NGN at 1 USD = 1500 NGN, then to kobo for Paystack.
   */
  async initializeTransaction(params: PaystackInitializeInput): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  } | { error: string }> {
    const amountInKobo = Math.round(params.amount * USD_TO_NGN * NGN_TO_KOBO);
    const callbackUrl =
      params.callback_url ||
      `${process.env.BASE_URL || ''}/wallet/callback`;

    if (!process.env.PAYSTACK_SECRET_KEY?.trim()) {
      return { error: 'Paystack is not configured (PAYSTACK_SECRET_KEY missing)' };
    }

    try {
      const body = {
        email: params.email,
        amount: amountInKobo,
        currency: 'NGN',
        reference: params.reference,
        callback_url: callbackUrl,
        metadata: params.metadata,
      };
      const response = await this.api.post<PaystackInitializeResponse>(
        '/transaction/initialize',
        body,
      );

      const data = response.data?.data;
      if (!response.data?.status || !data?.authorization_url) {
        const msg = (response.data as any)?.message || 'Paystack returned no payment URL';
        console.error('[Paystack] Initialize failed:', response.data);
        return { error: msg };
      }

      return {
        authorization_url: data.authorization_url,
        access_code: data.access_code,
        reference: data.reference,
      };
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Paystack request failed';
      const status = err?.response?.status;
      console.error('[Paystack] Initialize error:', status, msg, err?.response?.data);
      return { error: msg };
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
