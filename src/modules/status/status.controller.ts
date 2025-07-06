import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Controller, UseGuards } from '@nestjs/common';

@Controller('status')
@UseGuards(JwtAuthGuard)
export class StatusController {}
