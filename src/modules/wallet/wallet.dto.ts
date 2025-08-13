import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class WalletDto {
  @IsNumber()
  @Transform(({ value }) => Number(value))
  amount: number;
}

export class sendGiftDto {
  @IsString()
  giftId: string;

  @IsString()
  receiverId: string;
}
