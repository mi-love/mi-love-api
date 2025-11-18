import { Controller, Get, UseGuards } from '@nestjs/common';
import { StreamService } from './stream.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UserWithoutPassword } from '@/common/types/db';
import { User } from '@/common/decorator/user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('streams')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Get('token')
  getToken(@User() user: UserWithoutPassword) {
    return this.streamService.getToken(user);
  }
}
