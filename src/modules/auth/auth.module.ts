import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from '../../common/strategies/google.strategy';
import { AppleStrategy } from '../../common/strategies/apple.strategy';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { InterestService } from '@/common/services/interest.service';
import { MailService } from '@/common/services/mail.service';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    AppleStrategy,
    JwtStrategy,
    InterestService,
    MailService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
