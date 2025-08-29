import { BadGatewayException, Injectable } from '@nestjs/common';
import { sendGiftDto, WalletDto } from './wallet.dto';
import { UserWithoutPassword } from '@/common/types/db';
import { DbService } from '@/database/database.service';
import { PaymentService } from '@/common/services/payment.service';
import { nanoid } from 'nanoid';
import {
  PaginationParams,
  PaginationUtils,
} from '@/common/services/pagination.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly db: DbService,
    private readonly pagination: PaginationUtils,
    private readonly paymentService: PaymentService,
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

    const wallet = await this.db.wallet.findUnique({
      where: {
        id: user.walletId,
      },
    });

    if (!wallet || wallet.balance < gift.points) {
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
          amount: gift.points,
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
          amount: gift.points,
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
    const id = `tx-${nanoid()}`;
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
        type: 'debit',
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
    };
  }

  async walletCallback(tx_ref: string) {
    if (!tx_ref) {
      throw new BadGatewayException({
        message: 'Invalid transaction',
      });
    }
    const transactionDetails = await this.db.transaction.findUnique({
      where: {
        id: tx_ref,
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

    // if (statusQuery !== 'successful') {
    //   throw new BadGatewayException({
    //     message: 'Payment was not successful',
    //   });
    // }

    const status = await this.paymentService.verifyPayment(tx_ref);
    if (status) {
      await this.db.transaction.update({
        where: { id: tx_ref },
        data: {
          status: 'success',
        },
      });
      return {
        message: 'Payment successful',
        status: 'success',
      };
    }

    await this.db.transaction.update({
      where: { id: tx_ref },
      data: {
        status: 'failed',
      },
    });

    const points = transactionDetails.amount * 10; // 1 USD = 10 points

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
    return {
      message: 'Payment failed',
      status: 'failed',
    };
  }
}
