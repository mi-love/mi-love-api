import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { sendGiftDto, WalletDto, DeductDto } from './wallet.dto';
import { WalletService } from './wallet.service';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PaginationParams } from '@/common/services/pagination.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getWalletInfo(@User() user: UserWithoutPassword) {
    return this.walletService.getWalletInfo(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/buy-coins')
  buyCoins(@Body() walletDto: WalletDto, @User() user: UserWithoutPassword) {
    return this.walletService.buyCoins(walletDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/gifts')
  getGifts(@Query() query: PaginationParams) {
    return this.walletService.getAllGifts(query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/gifts/send')
  sendGift(
    @Body() sendGiftBody: sendGiftDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.walletService.sendGift(sendGiftBody, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/transactions')
  getTransactions(
    @Query() query: PaginationParams,
    @User() user: UserWithoutPassword,
  ) {
    return this.walletService.getTransactions(user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/transactions/:id')
  getTransactionById(
    @Param('id') id: string,
    @User() user: UserWithoutPassword,
  ) {
    return this.walletService.getTransactionById(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/deduct')
  deductCoins(@Body() deductDto: DeductDto, @User() user: UserWithoutPassword) {
    return this.walletService.deductCoins(deductDto, user);
  }

  @Get('/checkout')
  getCheckoutPage(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      throw new BadRequestException({ message: 'Missing token' });
    }
    const html = this.walletService.getCheckoutPageHtml(token);
    if (!html) {
      throw new BadRequestException({
        message: 'Invalid or expired checkout link',
      });
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('/redirect')
  async redirectToProvider(
    @Query('token') token: string,
    @Query('provider') provider: 'paystack' | 'flutterwave',
    @Res() res: Response,
  ) {
    if (!token || !provider) {
      throw new BadRequestException({
        message: 'Missing token or provider',
      });
    }
    if (provider !== 'paystack' && provider !== 'flutterwave') {
      throw new BadRequestException({
        message: 'Provider must be paystack or flutterwave',
      });
    }
    const redirectUrl = await this.walletService.redirectToProvider(
      token,
      provider,
    );
    res.redirect(redirectUrl);
  }

  @Get('/callback')
  walletCallback(@Query() query: any, @Res() res: Response) {
    const { tx_ref, status, transaction_id, reference } = query;
    const redirectUrl = this.walletService.walletCallback(
      tx_ref,
      status,
      transaction_id,
      reference,
    );
    res.redirect(redirectUrl);
  }
}
