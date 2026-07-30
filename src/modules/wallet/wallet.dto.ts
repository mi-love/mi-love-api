import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

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

  /**
   * App deep-link for post-payment redirect.
   * Example: zeelove://payment/callback
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/.+/, {
    message:
      'callbackUrl must be a valid app deep link (e.g. zeelove://payment/callback)',
  })
  callbackUrl?: string;
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
