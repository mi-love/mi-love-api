import { Module } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { WhatsappService } from '@/common/services/whatsapp.service';
import { LocationService } from '@/common/services/location.service';

@Module({
  providers: [EmergencyService, WhatsappService, LocationService],
  imports: [],
  controllers: [EmergencyController],
})
export class EmergencyModule {}
