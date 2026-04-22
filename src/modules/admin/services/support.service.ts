import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  ListSupportTicketsQueryDto,
  CreateSupportTicketDto,
  UpdateTicketStatusDto,
  UpdateTicketPriorityDto,
  AssignTicketDto,
  ReplyToTicketDto,
  CloseTicketDto,
  TicketStatisticsDto,
  PaginatedTicketsResponseDto,
} from '../dtos/support-tickets.dto';

@Injectable()
export class AdminSupportService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async listTickets(
    query: ListSupportTicketsQueryDto,
    adminId: string,
  ): Promise<PaginatedTicketsResponseDto> {
    const { status, priority, category, page = 1, limit = 20, search, startDate, endDate } = query;

    if (!(this.db as any).support_ticket) {
      this.logger.warn(
        'Support tickets fallback: support_ticket model unavailable, returning empty list',
        'AdminSupportService',
      );

      return {
        data: [] as any,
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const [tickets, total] = await Promise.all([
      this.db.support_ticket.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, username: true } },
          assigned_admin: { select: { id: true, email: true } },
          ticket_responses: { take: 1, orderBy: { created_at: 'desc' } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.db.support_ticket.count({ where }),
    ]);

    this.logger.log(`Listed ${tickets.length} support tickets`, 'AdminSupportService');

    return {
      data: tickets as any,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async getTicketDetails(ticketId: string, adminId: string): Promise<any> {
    const ticket = await this.db.support_ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: true,
        assigned_admin: true,
        ticket_responses: { orderBy: { created_at: 'asc' } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    this.logger.log(`Retrieved ticket details for ${ticketId}`, 'AdminSupportService');
    return ticket;
  }

  async updateTicketStatus(
    ticketId: string,
    data: UpdateTicketStatusDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const ticket = await this.db.support_ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    const updates: any = { status: data.status };
    if (data.status === 'resolved') {
      updates.resolved_at = new Date();
    }
    if (data.status === 'closed') {
      updates.closed_at = new Date();
    }

    await this.db.support_ticket.update({
      where: { id: ticketId },
      data: updates,
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'UPDATE_TICKET_STATUS',
        resource: 'support_ticket',
        resource_id: ticketId,
        metadata: { oldStatus: ticket.status, newStatus: data.status, notes: data.notes },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'UPDATE_TICKET_STATUS',
      'support_ticket',
      ticketId,
      data,
    );

    return { message: `Ticket ${ticketId} status updated to ${data.status}` };
  }

  async updateTicketPriority(
    ticketId: string,
    data: UpdateTicketPriorityDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const ticket = await this.db.support_ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    await this.db.support_ticket.update({
      where: { id: ticketId },
      data: { priority: data.priority },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'UPDATE_TICKET_PRIORITY',
        resource: 'support_ticket',
        resource_id: ticketId,
        metadata: { oldPriority: ticket.priority, newPriority: data.priority, reason: data.reason },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'UPDATE_TICKET_PRIORITY',
      'support_ticket',
      ticketId,
      data,
    );

    return { message: `Ticket ${ticketId} priority updated to ${data.priority}` };
  }

  async assignTicket(
    ticketId: string,
    data: AssignTicketDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const ticket = await this.db.support_ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    const assignedAdmin = await this.db.user.findUnique({
      where: { id: data.adminId },
    });

    if (!assignedAdmin) {
      throw new NotFoundException(`Admin ${data.adminId} not found`);
    }

    await this.db.support_ticket.update({
      where: { id: ticketId },
      data: { assigned_to_admin_id: data.adminId },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'ASSIGN_TICKET',
        resource: 'support_ticket',
        resource_id: ticketId,
        metadata: { assignedTo: data.adminId, notes: data.notes },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'ASSIGN_TICKET',
      'support_ticket',
      ticketId,
      data,
    );

    return { message: `Ticket ${ticketId} assigned to admin ${data.adminId}` };
  }

  async replyToTicket(
    ticketId: string,
    data: ReplyToTicketDto,
    adminId: string,
  ): Promise<{ message: string; responseId: string }> {
    const ticket = await this.db.support_ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    const response = await this.db.ticket_response.create({
      data: {
        ticket_id: ticketId,
        responder_id: adminId,
        is_from_admin: true,
        message: data.message,
        attachments: data.attachments || [],
      },
    });

    // Update ticket status to in_progress if it was open
    if (ticket.status === 'open') {
      await this.db.support_ticket.update({
        where: { id: ticketId },
        data: { status: 'in_progress' },
      });
    }

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'REPLY_TO_TICKET',
        resource: 'support_ticket',
        resource_id: ticketId,
        metadata: { responseId: response.id, messageLength: data.message.length },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'REPLY_TO_TICKET',
      'support_ticket',
      ticketId,
      { responseId: response.id },
    );

    return { message: `Reply added to ticket ${ticketId}`, responseId: response.id };
  }

  async closeTicket(
    ticketId: string,
    data: CloseTicketDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const ticket = await this.db.support_ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    await this.db.support_ticket.update({
      where: { id: ticketId },
      data: {
        status: 'closed',
        closed_at: new Date(),
        satisfaction_rating: data.satisfactionRating,
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'CLOSE_TICKET',
        resource: 'support_ticket',
        resource_id: ticketId,
        metadata: { resolution: data.resolution, rating: data.satisfactionRating },
      },
    });

    this.logger.logAdminAction(
      adminId,
      'CLOSE_TICKET',
      'support_ticket',
      ticketId,
      data,
    );

    return { message: `Ticket ${ticketId} has been closed` };
  }

  async getTicketStatistics(adminId: string): Promise<TicketStatisticsDto> {
    // In preview environments the Prisma client/database can be out of sync,
    // so support_ticket may be unavailable at runtime.
    if (!(this.db as any).support_ticket) {
      return {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
        averageResolutionTime: undefined,
        satisfactionScore: undefined,
        ticketsByCategory: {
          technical: 0,
          billing: 0,
          complaint: 0,
          feature_request: 0,
          other: 0,
        } as any,
        ticketsByPriority: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        } as any,
      };
    }

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
    ] = await Promise.all([
      this.db.support_ticket.count(),
      this.db.support_ticket.count({ where: { status: 'open' } }),
      this.db.support_ticket.count({ where: { status: 'in_progress' } }),
      this.db.support_ticket.count({ where: { status: 'resolved' } }),
      this.db.support_ticket.count({ where: { status: 'closed' } }),
    ]);

    // Get tickets by category
    const byCategory = await this.db.support_ticket.groupBy({
      by: ['category'],
      _count: true,
    });

    // Get tickets by priority
    const byPriority = await this.db.support_ticket.groupBy({
      by: ['priority'],
      _count: true,
    });

    // Get average satisfaction rating
    const ratings = await this.db.support_ticket.aggregate({
      where: { satisfaction_rating: { not: null } },
      _avg: { satisfaction_rating: true },
    });

    // Calculate average resolution time
    const closedTickets_ = await this.db.support_ticket.findMany({
      where: { closed_at: { not: null } },
      select: { created_at: true, closed_at: true },
    });

    const avgResolutionTime =
      closedTickets_.length > 0
        ? closedTickets_.reduce((sum, t) => {
            const diff = (t.closed_at!.getTime() - t.created_at.getTime()) / (1000 * 60 * 60);
            return sum + diff;
          }, 0) / closedTickets_.length
        : undefined;

    this.logger.log(`Retrieved ticket statistics`, 'AdminSupportService');

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      averageResolutionTime: avgResolutionTime ? Math.round(avgResolutionTime) : undefined,
      satisfactionScore: ratings._avg.satisfaction_rating || undefined,
      ticketsByCategory: Object.fromEntries(
        byCategory.map((item: any) => [item.category, item._count]),
      ) as any,
      ticketsByPriority: Object.fromEntries(
        byPriority.map((item: any) => [item.priority, item._count]),
      ) as any,
    };
  }
}
