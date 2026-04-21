import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../../common/guards/admin-role.guard';
import { User } from '../../../common/decorator/user.decorator';
import { AdminSupportService } from '../services/support.service';
import {
  ListSupportTicketsQueryDto,
  UpdateTicketStatusDto,
  UpdateTicketPriorityDto,
  AssignTicketDto,
  ReplyToTicketDto,
  CloseTicketDto,
} from '../dtos/support-tickets.dto';

@Controller('admin/support')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSupportController {
  constructor(private supportService: AdminSupportService) {}

  @Get('tickets')
  async listTickets(@Query() query: ListSupportTicketsQueryDto, @User() user: any) {
    return this.supportService.listTickets(query, user.id);
  }

  @Get('tickets/:id')
  async getTicketDetails(@Param('id') ticketId: string, @User() user: any) {
    return this.supportService.getTicketDetails(ticketId, user.id);
  }

  @Patch('tickets/:id/status')
  async updateTicketStatus(
    @Param('id') ticketId: string,
    @Body() data: UpdateTicketStatusDto,
    @User() user: any,
  ) {
    return this.supportService.updateTicketStatus(ticketId, data, user.id);
  }

  @Patch('tickets/:id/priority')
  async updateTicketPriority(
    @Param('id') ticketId: string,
    @Body() data: UpdateTicketPriorityDto,
    @User() user: any,
  ) {
    return this.supportService.updateTicketPriority(ticketId, data, user.id);
  }

  @Patch('tickets/:id/assign')
  async assignTicket(
    @Param('id') ticketId: string,
    @Body() data: AssignTicketDto,
    @User() user: any,
  ) {
    return this.supportService.assignTicket(ticketId, data, user.id);
  }

  @Post('tickets/:id/reply')
  async replyToTicket(
    @Param('id') ticketId: string,
    @Body() data: ReplyToTicketDto,
    @User() user: any,
  ) {
    return this.supportService.replyToTicket(ticketId, data, user.id);
  }

  @Patch('tickets/:id/close')
  async closeTicket(
    @Param('id') ticketId: string,
    @Body() data: CloseTicketDto,
    @User() user: any,
  ) {
    return this.supportService.closeTicket(ticketId, data, user.id);
  }

  @Get('statistics')
  async getTicketStatistics(@User() user: any) {
    return this.supportService.getTicketStatistics(user.id);
  }
}
