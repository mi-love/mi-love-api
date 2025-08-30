import { IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsOptional()
  message: string;

  @IsString()
  @IsOptional()
  fileId?: string;
}
