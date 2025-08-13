import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
interface PaymentLinkResponse {
  status: 'success';
  message: string;
  data: {
    link: string;
  };
}

interface PaymentLinkRequest {
  tx_ref: string;
  amount: number;
  currency?: string;
  redirect_url?: string;
  email?: string;
  name?: string;
  phonenumber?: string;
}

interface VerifyPaymentResponse {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  narration: string;
  status: string;
  payment_type: string;
  created_at: string;
  account_id: number;
}
@Injectable()
export class PaymentService {
  private readonly baseUrl: string;
  private readonly api: AxiosInstance;
  constructor() {
    this.baseUrl = 'https://api.flutterwave.com/v3';
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FLU_SECRET_KEY}`,
      },
    });
  }

  async createPaymentLink({
    currency,
    amount,
    email,
    phonenumber,
    name,
    tx_ref,
  }: PaymentLinkRequest) {
    try {
      const response = await this.api.post<PaymentLinkResponse>('/payments', {
        tx_ref,
        amount: String(amount),
        currency: currency || 'USD',
        redirect_url: `${process.env.BASE_URL}/wallet/callback`,
        customer: {
          email,
          name,
          phonenumber,
        },
        customizations: {
          title: 'Milove Payment',
        },
      });
      return response.data;
    } catch {
      return null;
    }
  }

  async verifyPayment(tx_ref: string) {
    try {
      const { data: transactionDetails } = await this.api.get<{
        data: VerifyPaymentResponse;
      }>(`/transactions/verify_by_reference?tx_ref=${tx_ref}`);

      if (transactionDetails.data.status == 'successful') {
        return true;
      }

      // if (
      //   response.data.status === 'successful' &&
      //   response.data.amount === transactionDetails.amount
      // ) {
      //   return true;
      // }

      return false;
    } catch {
      return false;
    }
  }
}
