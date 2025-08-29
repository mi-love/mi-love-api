import { All, Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  MetaWebhookParamsDto,
  MetaWebhookResponse,
  PanicDto,
} from './emergency.dto';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';

@Controller('emergencies')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/panic')
  async handlePanicButtonPress(
    @Body() body: PanicDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.emergencyService.handlePanicButtonPress(user, body);
  }

  @All('/webhook')
  async handleWebhook(
    @Body() body: MetaWebhookResponse,
    @Query() query: MetaWebhookParamsDto,
  ) {
    return this.emergencyService.handleWebhook(body, query);
  }
}
