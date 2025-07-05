import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { InterestService } from '@/common/services/interest.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '@/common/services/mail.service';

@Module({
  imports: [],
  controllers: [ProfileController],
  providers: [ProfileService, InterestService, AuthService, MailService],
})
export class ProfileModule {}
