import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
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

  @Get('/callback')
  walletCallback(@Query() query: any) {
    const { tx_ref, status, transaction_id, reference } = query;
    return this.walletService.walletCallback(
      tx_ref,
      status,
      transaction_id,
      reference,
    );
  }
}
