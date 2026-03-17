import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = process.env.JWT_SECRET || "secret";
        if (!secret || typeof secret !== 'string' || secret.length === 0) {
          throw new Error(
            'JWT_SECRET must be set in .env. Add JWT_SECRET=your-secret to your .env file.',
          );
        }
        return { secret };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [JwtService],
  exports: [JwtService],
})
export class JwtGlobalModule {}
