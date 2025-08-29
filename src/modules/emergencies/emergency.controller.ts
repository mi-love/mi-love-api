import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PanicDto } from './emergency.dto';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';

@UseGuards(JwtAuthGuard)
@Controller('emergencies')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post('/panic')
  async handlePanicButtonPress(
    @Body() body: PanicDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.emergencyService.handlePanicButtonPress(user.id, body);
  }
}
