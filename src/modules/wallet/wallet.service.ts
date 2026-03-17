import { BadGatewayException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { sendGiftDto, WalletDto, DeductDto } from './wallet.dto';
import { UserWithoutPassword } from '@/common/types/db';
import { DbService } from '@/database/database.service';
import { PaymentService } from '@/common/services/payment.service';
import { PaystackService } from '@/common/services/paystack.service';
import { nanoid } from 'nanoid';
import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';

const PAYSTACK_PREFIX = 'paystack-';
const FLUTTERWAVE_PREFIX = 'tx-';
const CHECKOUT_TOKEN_EXPIRY = '15m';

export type PaymentProviderChoice = 'paystack' | 'flutterwave';

export interface CheckoutTokenPayload {
  sub: string;
  amount: number;
  intentId: string;
  email: string;
  name: string;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly db: DbService,
    private readonly pagination: PaginationUtils,
    private readonly paymentService: PaymentService,
    private readonly paystackService: PaystackService,
    private readonly jwtService: JwtService,
  ) {}

  async sendGift(sendGiftBody: sendGiftDto, user: UserWithoutPassword) {
    const { giftId, receiverId } = sendGiftBody;
    const gift = await this.db.gift.findUnique({
      where: {
        id: giftId,
      },
    });

    if (!gift) {
      throw new BadGatewayException({
        message: 'Gift not found',
      });
    }

    const receiver = await this.db.user.findUnique({
      where: {
        id: receiverId,
      },
    });

    if (!receiver) {
      throw new BadGatewayException({
        message: 'Receiver not found',
      });
    }

    // const isFriend = await this.db.user.findUnique({
    //   where: {
    //     id: user.id,
    //     my_friends: {
    //       some: {
    //         id: receiverId,
    //       },
    //     },
    //   },
    // });

    // if (!isFriend) {
    //   throw new BadGatewayException({
    //     message: 'You can only send gifts to friends',
    //   });
    // }

    const wallet = await this.db.wallet.findUnique({
      where: {
        id: user.walletId,
      },
    });

    // console.log(wallet?.balance, gift.points);
    if (Number(wallet?.balance ?? '0') < Number(gift.points)) {
      throw new BadGatewayException({
        message: 'Insufficient balance',
      });
    }

    await this.db.$transaction(async (prisma) => {
      await prisma.wallet.update({
        where: {
          id: user.walletId,
        },
        data: {
          balance: {
            decrement: gift.points,
          },
        },
      });

      await prisma.wallet.update({
        where: {
          id: receiver.walletId,
        },
        data: {
          balance: {
            increment: gift.points,
          },
        },
      });

      await prisma.transaction.create({
        data: {
          amount: Number(gift.points),
          type: 'debit',
          currency: 'USD',
          status: 'success',
          description: `Gift sent: ${gift.name} to ${receiver.first_name} ${receiver.last_name}`,
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });

      await prisma.transaction.create({
        data: {
          amount: Number(gift.points),
          type: 'credit',
          currency: 'USD',
          status: 'success',
          description: `Gift received: ${gift.name} from ${user.first_name} ${user.last_name}`,
          user: {
            connect: {
              id: receiver.id,
            },
          },
        },
      });
    });
    // TODO[] send notification
    return {
      message: 'Gift sent successfully',
    };
  }

  async getAllGifts(query: PaginationParams) {
    const { limit, skip } = this.pagination.getPagination(query);
    const where = {};
    const all = await this.db.gift.count({ where });
    const gifts = await this.db.gift.findMany({
      where,
      skip,
      take: limit,
      include: {
        image: {
          select: {
            url: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      data: gifts,
      meta: this.pagination.getMeta({
        limit,
        page: query.page,
        totalItems: all,
      }),
    };
  }

  async getWalletInfo(user: UserWithoutPassword) {
    const userInfo = await this.db.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        wallet: {
          select: {
            balance: true,
            updated_at: true,
          },
        },
      },
    });
    return {
      data: {
        ...userInfo?.wallet,
        balance: Number(userInfo?.wallet?.balance ?? 0),
      },
      message: 'Wallet information retrieved successfully',
    };
  }

  async buyCoins(walletDto: WalletDto, user: UserWithoutPassword) {
    if (walletDto.amount > 1000) {
      throw new BadGatewayException({
        message: 'Purchase amount cannot exceed 1000 USD',
      });
    }

    const baseUrl = process.env.BASE_URL || '';
    const provider = walletDto.provider;

    if (!provider) {
      const intentId = nanoid();
      const token = this.jwtService.sign(
        {
          sub: user.id,
          amount: walletDto.amount,
          intentId,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
        } as CheckoutTokenPayload,
        { expiresIn: CHECKOUT_TOKEN_EXPIRY },
      );
      const checkoutLink = `${baseUrl}/wallet/checkout?token=${token}`;
      return {
        message: 'Checkout link created. Complete payment on the page.',
        link: checkoutLink,
        amount: walletDto.amount,
      };
    }

    const callbackUrl = `${baseUrl}/wallet/callback`;

    if (provider === 'paystack') {
      const id = `${PAYSTACK_PREFIX}${nanoid()}`;
      const paystackResult = await this.paystackService.initializeTransaction({
        email: user.email,
        amount: walletDto.amount,
        currency: 'USD',
        reference: id,
        callback_url: callbackUrl,
        metadata: { userId: user.id },
      });

      if (!paystackResult?.authorization_url) {
        throw new BadGatewayException({
          message: 'Failed to create Paystack payment link',
        });
      }

      await this.db.transaction.create({
        data: {
          id,
          amount: walletDto.amount,
          type: 'credit',
          currency: 'USD',
          status: 'pending',
          payment_link: paystackResult.authorization_url,
          description: 'Purchase of coins (Paystack)',
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });

      return {
        message: 'Payment link created successfully',
        link: paystackResult.authorization_url,
        provider: 'paystack',
      };
    }

    const id = `${FLUTTERWAVE_PREFIX}${nanoid()}`;
    const payment = await this.paymentService.createPaymentLink({
      amount: walletDto.amount,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      phonenumber: user.phone_number ?? '',
      tx_ref: id,
      currency: 'USD',
    });

    if (!payment || !payment.data?.link) {
      throw new BadGatewayException({
        message: 'Failed to create payment link',
      });
    }

    await this.db.transaction.create({
      data: {
        id,
        amount: walletDto.amount,
        type: 'credit',
        currency: 'USD',
        status: 'pending',
        payment_link: payment?.data.link,
        description: 'Purchase of coins',
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    return {
      message: 'Payment link created successfully',
      link: payment.data.link,
      provider: 'flutterwave',
    };
  }

  verifyCheckoutToken(token: string): CheckoutTokenPayload | null {
    try {
      const payload = this.jwtService.verify<CheckoutTokenPayload>(token);
      return payload?.sub && payload?.amount != null ? payload : null;
    } catch {
      return null;
    }
  }

  getCheckoutPageHtml(token: string): string | null {
    const payload = this.verifyCheckoutToken(token);
    if (!payload) return null;
    const baseUrl = process.env.BASE_URL || '';
    const paystackUrl = `${baseUrl}/wallet/redirect?token=${encodeURIComponent(token)}&provider=paystack`;
    const flutterwaveUrl = `${baseUrl}/wallet/redirect?token=${encodeURIComponent(token)}&provider=flutterwave`;
    const amount = Number(payload.amount);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi-Love — Pay for coins</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(160deg, #fef2f7 0%, #fff 50%);
      color: #1a1a1a;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 1.5rem; margin: 0 0 8px; color: #1a1a1a; }
    .amount {
      font-size: 1.75rem;
      font-weight: 700;
      color: #d41372;
      margin-bottom: 24px;
    }
    p { color: #666; margin: 0 0 24px; font-size: 0.95rem; line-height: 1.5; }
    .buttons { display: flex; flex-direction: column; gap: 12px; }
    a {
      display: block;
      padding: 14px 20px;
      border-radius: 12px;
      font-weight: 600;
      text-decoration: none;
      text-align: center;
      font-size: 1rem;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    a:active { transform: scale(0.98); }
    .btn-paystack {
      background: #00c3f7;
      color: #fff;
      box-shadow: 0 2px 12px rgba(0,195,247,0.35);
    }
    .btn-paystack:hover { box-shadow: 0 4px 16px rgba(0,195,247,0.45); }
    .btn-flutterwave {
      background: #f5a623;
      color: #1a1a1a;
      box-shadow: 0 2px 12px rgba(245,166,35,0.35);
    }
    .btn-flutterwave:hover { box-shadow: 0 4px 16px rgba(245,166,35,0.45); }
    .note { font-size: 0.8rem; color: #999; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Purchase coins</h1>
    <div class="amount">$${amount.toFixed(2)} USD</div>
    <p>Choose how you’d like to pay. You’ll be redirected to a secure payment page.</p>
    <div class="buttons">
      <a href="${paystackUrl}" class="btn-paystack">Pay with Paystack</a>
      <a href="${flutterwaveUrl}" class="btn-flutterwave">Pay with Flutterwave (card, bank transfer, USSD)</a>
    </div>
    <p class="note">Flutterwave supports card, bank transfer, and USSD.</p>
  </div>
</body>
</html>`;
  }

  async redirectToProvider(
    token: string,
    provider: PaymentProviderChoice,
  ): Promise<string> {
    const payload = this.verifyCheckoutToken(token);
    if (!payload) {
      throw new BadGatewayException({ message: 'Invalid or expired checkout link' });
    }

    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      include: { wallet: true },
    });
    if (!user) {
      throw new BadGatewayException({ message: 'User not found' });
    }

    const callbackUrl = `${process.env.BASE_URL || ''}/wallet/callback`;
    const { amount } = payload;

    if (provider === 'paystack') {
      const id = `${PAYSTACK_PREFIX}${nanoid()}`;
      const result = await this.paystackService.initializeTransaction({
        email: payload.email,
        amount,
        currency: 'USD',
        reference: id,
        callback_url: callbackUrl,
        metadata: { userId: user.id },
      });
      if (!result?.authorization_url) {
        throw new BadGatewayException({
          message: 'Failed to create Paystack payment link',
        });
      }
      await this.db.transaction.create({
        data: {
          id,
          amount,
          type: 'credit',
          currency: 'USD',
          status: 'pending',
          payment_link: result.authorization_url,
          description: 'Purchase of coins (Paystack)',
          user: { connect: { id: user.id } },
        },
      });
      return result.authorization_url;
    }

    const id = `${FLUTTERWAVE_PREFIX}${nanoid()}`;
    const payment = await this.paymentService.createPaymentLink({
      amount,
      email: payload.email,
      name: payload.name,
      phonenumber: user.phone_number ?? '',
      tx_ref: id,
      currency: 'USD',
    });
    if (!payment?.data?.link) {
      throw new BadGatewayException({
        message: 'Failed to create Flutterwave payment link',
      });
    }
    await this.db.transaction.create({
      data: {
        id,
        amount,
        type: 'credit',
        currency: 'USD',
        status: 'pending',
        payment_link: payment.data.link,
        description: 'Purchase of coins (Flutterwave)',
        user: { connect: { id: user.id } },
      },
    });
    return payment.data.link;
  }

  async walletCallback(
    tx_ref: string,
    status?: string,
    transaction_id?: string,
    reference?: string,
  ) {
    const ref = reference || tx_ref;
    if (!ref) {
      throw new BadGatewayException({
        message: 'Invalid transaction',
      });
    }

    const transactionDetails = await this.db.transaction.findUnique({
      where: {
        id: ref,
        status: {
          not: 'success',
        },
      },
    });
    if (!transactionDetails) {
      throw new BadGatewayException({
        message: 'Invalid transaction',
      });
    }

    const isPaystack = ref.startsWith(PAYSTACK_PREFIX);
    const isPaymentSuccessful = isPaystack
      ? await this.paystackService.verifyTransaction(ref)
      : await this.paymentService.verifyPayment(ref);
    if (isPaymentSuccessful) {
      await this.db.transaction.update({
        where: { id: ref },
        data: {
          status: 'success',
        },
      });
      const points = Number(transactionDetails.amount * 10); // 1 USD = 10 points
      // console.log('> Funded with ', points);
      await this.db.user.update({
        where: {
          id: transactionDetails.userId,
        },
        data: {
          wallet: {
            update: {
              balance: {
                increment: points,
              },
            },
          },
        },
      });

      console.log('Redirecting to transaction detail');
      return `milove://payment-callback?status=successful&transaction_id=${transaction_id || ref}&reference=${ref}`;
      // return {
      //   message: 'Payment successful',
      //   status: 'success',
      // };
    }

    await this.db.transaction.update({
      where: { id: tx_ref },
      data: {
        status: 'failed',
      },
    });

    return `milove://payment-callback?status=failed&reference=${reference || ref}`;
  }

  async getTransactions(user: UserWithoutPassword, query: PaginationParams) {
    const { limit, skip } = this.pagination.getPagination(query);
    const where = { userId: user.id };
    const all = await this.db.transaction.count({ where });
    const transactions = await this.db.transaction.findMany({
      where,
      skip,
      select: {
        amount: true,
        id: true,
        currency: true,
        status: true,
        type: true,
        created_at: true,
      },
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      data: transactions,
      meta: this.pagination.getMeta({
        limit,
        page: query.page,
        totalItems: all,
      }),
    };
  }

  async getTransactionById(id: string, user: UserWithoutPassword) {
    const transaction = await this.db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!transaction) {
      throw new BadGatewayException({
        message: 'Transaction not found',
      });
    }

    return {
      data: transaction,
      message: 'Transaction retrieved successfully',
    };
  }

  async deductCoins(deductDto: DeductDto, user: UserWithoutPassword) {
    const { amount, description } = deductDto;

    const wallet = await this.db.wallet.findUnique({
      where: {
        id: user.walletId,
      },
    });

    if (Number(wallet?.balance ?? '0') < amount) {
      throw new BadGatewayException({
        message: 'Insufficient balance',
      });
    }

    await this.db.$transaction(async (prisma) => {
      await prisma.wallet.update({
        where: {
          id: user.walletId,
        },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      await prisma.transaction.create({
        data: {
          amount: -amount,
          type: 'debit',
          currency: 'USD',
          status: 'success',
          description,
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });
    });

    return {
      message: 'Coins deducted successfully',
    };
  }
}
