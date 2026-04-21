import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
} from 'class-validator';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
export type TicketCategory = 'technical' | 'billing' | 'complaint' | 'feature_request' | 'other';

// List Tickets DTO
export class ListSupportTicketsQueryDto {
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'resolved', 'closed', 'reopened'])
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(['technical', 'billing', 'complaint', 'feature_request', 'other'])
  category?: TicketCategory;

  @IsOptional()
  @IsString()
  search?: string; // Search in subject and description

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
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Ticket Details DTO
export class SupportTicketDetailDto {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  attachments?: string[];
  responses?: TicketResponseDto[];
  assignedToAdminId?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

// Response/Reply DTO
export class TicketResponseDto {
  id: string;
  ticketId: string;
  responderId: string; // admin ID or user ID
  isFromAdmin: boolean;
  message: string;
  attachments?: string[];
  createdAt: Date;
}

// Create/Update Ticket DTO
export class CreateSupportTicketDto {
  @IsString()
  subject: string;

  @IsString()
  description: string;

  @IsEnum(['technical', 'billing', 'complaint', 'feature_request', 'other'])
  category: TicketCategory;

  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority: TicketPriority;

  @IsOptional()
  attachments?: string[];
}

export class UpdateTicketStatusDto {
  @IsEnum(['open', 'in_progress', 'resolved', 'closed', 'reopened'])
  status: TicketStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTicketPriorityDto {
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority: TicketPriority;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignTicketDto {
  @IsString()
  adminId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReplyToTicketDto {
  @IsString()
  message: string;

  @IsOptional()
  attachments?: string[];
}

export class CloseTicketDto {
  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  satisfactionRating?: number;
}

// Statistics DTO
export class TicketStatisticsDto {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResolutionTime?: number; // in hours
  satisfactionScore?: number; // out of 5
  ticketsByCategory?: Record<TicketCategory, number>;
  ticketsByPriority?: Record<TicketPriority, number>;
  ticketsByStatus?: Record<TicketStatus, number>;
}

// Paginated Response
export class PaginatedTicketsResponseDto {
  data: SupportTicketDetailDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
