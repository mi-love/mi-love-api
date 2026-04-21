import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

// List Chats DTO
export class ListChatsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  userId?: string; // Filter by specific user

  @IsOptional()
  @IsString()
  search?: string; // Search by participant names

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// List Messages DTO
export class ListMessagesQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Chat Details DTO
export class ChatDetailsDto {
  id: string;
  participants: Array<{
    id: string;
    email: string;
    username: string;
    avatar?: string;
  }>;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  isActive: boolean;
}

// Message Details DTO
export class MessageDetailsDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type?: 'text' | 'image' | 'file';
  fileUrl?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Delete Message DTO
export class DeleteMessageDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  isHardDelete?: boolean;
}

// Archive Chat DTO
export class ArchiveChatDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

// Chat Statistics DTO
export class ChatStatisticsDto {
  totalChats: number;
  activeChats: number;
  archivedChats: number;
  totalMessages: number;
  averageMessageLength?: number;
  messagesPerDay?: number;
  chatsByDate?: Record<string, number>;
  topChatParticipants?: Array<{
    userId: string;
    username: string;
    messageCount: number;
  }>;
}

// Paginated Chats Response
export class PaginatedChatsResponseDto {
  data: ChatDetailsDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Paginated Messages Response
export class PaginatedMessagesResponseDto {
  data: MessageDetailsDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Bulk Delete Messages DTO
export class BulkDeleteMessagesDto {
  @IsString({ each: true })
  messageIds: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}
