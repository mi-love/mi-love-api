import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DbService } from '@/database/database.service';
import { JwtService } from '@nestjs/jwt';
import { GoogleUser } from '@/common/types/o-auth-user';
import { SignupDto } from './auth.dto';
import { gender } from '@prisma/client';
@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.db.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'No account found with this credentials',
      });
    }

    if (!user?.password) {
      throw new BadRequestException({
        message: ` Your account is linked with ${user.auth_provider}`,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: secret, ...result } = user;
      return result;
    }

    throw new BadRequestException({
      message: 'No account found with this credentials',
    });
  }

  async checkUserExists(email: string) {
    const user = await this.db.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  async signup(signupDto: SignupDto) {
    const existingUser = await this.checkUserExists(signupDto.email);
    if (existingUser) {
      throw new BadRequestException({
        message: 'User with this email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);

    const user = await this.db.user.create({
      data: {
        password: hashedPassword,
        email: signupDto.email,
        first_name: signupDto.first_name,
        last_name: signupDto.last_name,
        phone_number: signupDto.phone_number,
        country: signupDto.country,
        gender: signupDto?.gender?.toLowerCase() as gender,
        auth_provider: 'local',
        date_of_birth: new Date(signupDto?.date_of_birth),
      },
    });

    return this.login({
      id: user.id,
    });
  }

  async login(user: { id: string }) {
    const payload = { sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async googleLogin(profile: GoogleUser) {
    let user = await this.db.user.findUnique({
      where: {
        email: profile.email,
      },
    });

    if (!user) {
      user = await this.db.user.create({
        data: {
          email: profile.email,
          first_name: profile.firstName,
          last_name: profile.lastName,
          auth_provider: 'google',
        },
      });
    }

    return this.login({
      id: user.id,
    });
  }

  async appleLogin(profile: any) {
    let user = await this.db.user.findUnique({
      where: {
        email: profile.email,
      },
    });

    if (!user) {
      user = await this.db.user.create({
        data: {
          email: profile.email,
          first_name: profile.name?.firstName || '',
          last_name: profile.name?.lastName || '',
          auth_provider: 'apple',
        },
      });
    }

    return this.login({
      id: user.id,
    });
  }
}
