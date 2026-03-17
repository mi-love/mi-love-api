import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export type PaymentProvider = 'flutterwave' | 'paystack';

export class WalletDto {
  @IsNumber()
  @Transform(({ value }) => Number(value))
  amount: number;

  /** Payment provider for buying coins. Defaults to "flutterwave". */
  @IsOptional()
  @IsString()
  @IsIn(['flutterwave', 'paystack'])
  provider?: PaymentProvider;
}

export class sendGiftDto {
  @IsString()
  giftId: string;

  @IsString()
  receiverId: string;
}

export class DeductDto {
  @IsNumber()
  @Transform(({ value }) => Number(value))
  amount: number;

  @IsString()
  description: string;
}
