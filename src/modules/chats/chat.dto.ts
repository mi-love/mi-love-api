import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsOptional()
  chatId?: string;

  @IsString()
  @IsOptional()
  toUserId?: string;

  @ValidateIf((o) => !o.fileId)
  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  fileId?: string;

  @IsString()
  @IsOptional()
  replyToMessageId?: string;
}

export class MessageReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string;
}
