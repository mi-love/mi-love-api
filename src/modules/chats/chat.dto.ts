import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
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

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds: string[];

  @IsString()
  @IsOptional()
  avatarFileId?: string;
}

export class AddGroupMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds: string[];
}
