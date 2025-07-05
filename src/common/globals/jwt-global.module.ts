import { Global, Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      //   signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [JwtService],
  exports: [JwtService],
})
export class JwtGlobalModule {}
