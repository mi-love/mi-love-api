import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { sendGiftDto, WalletDto } from './wallet.dto';
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

  @Get('/callback')
  walletCallback(@Query('tx_ref') tx_ref: string) {
    return this.walletService.walletCallback(tx_ref);
  }
}
