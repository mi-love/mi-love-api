import { BadGatewayException, Injectable } from '@nestjs/common';
import { sendGiftDto, WalletDto, DeductDto } from './wallet.dto';
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
    };
  }

  async walletCallback(
    tx_ref: string,
    status?: string,
    transaction_id?: string,
    reference?: string,
  ) {
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

    const isPaymentSuccessful = await this.paymentService.verifyPayment(tx_ref);
    if (isPaymentSuccessful) {
      await this.db.transaction.update({
        where: { id: tx_ref },
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
      return `milove://payment-callback?status=successful&transaction_id=${transaction_id || tx_ref}&reference=${reference || tx_ref}`;
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

    return `milove://payment-callback?status=failed&reference=${reference || tx_ref}`;
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
