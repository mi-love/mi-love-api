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
import { MailService } from '@/common/services/mail.service';
import { InterestService } from '@/common/services/interest.service';
import otpGenerator from 'otp-generator';
@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwtService: JwtService,
    private interestUtils: InterestService,
    private mailService: MailService,
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

  async checkUsernameExists(username: string) {
    const user = await this.db.user.findUnique({
      where: { username },
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

    const existingUsername = await this.checkUsernameExists(signupDto.username);
    if (existingUsername) {
      throw new BadRequestException({
        message: 'Username already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);

    const checkProfilePicture = await this.db.file.findUnique({
      where: {
        id: signupDto.profile_picture,
      },
    });

    if (!checkProfilePicture) {
      throw new BadRequestException({
        message: 'Profile picture not found or failed to upload',
      });
    }

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
        username: signupDto.username,
        emergency_contact: signupDto.emergency_contact,
        bio: signupDto.bio,
        profile_picture: {
          connect: {
            id: checkProfilePicture.id,
          },
        },
        home_address: signupDto.home_address,
        interests: {
          create: signupDto.interests.map((interest) => ({
            name: interest,
          })),
        },
        date_of_birth: new Date(signupDto?.date_of_birth),
      },
    });

    await this.interestUtils.addAndUpdateInterests(signupDto.interests, {
      userId: user.id,
    });

    return this.login({
      id: user.id,
    });
  }

  // async editUser(userId: string, editUserDto: Partial<SignupDto>) {
  //   const user = await this.db.user.findUnique({
  //     where: { id: userId },
  //   });

  //   if (!user) {
  //     throw new NotFoundException({
  //       message: 'User not found',
  //     });
  //   }

  //   // Prepare the update data
  //   const updateData: any = { ...editUserDto };

  //   // Handle interests separately
  //   if (editUserDto.interests !== undefined) {
  //     // First, disconnect all existing interests
  //     await this.db.user.update({
  //       where: { id: userId },
  //       data: {
  //         interests: {
  //           set: [], // This will disconnect all existing interests
  //         },
  //       },
  //     });

  //     // Then connect/create new interests
  //     if (editUserDto.interests.length > 0) {
  //       updateData.interests = {
  //         create: editUserDto.interests.map((interest) => ({
  //           name: interest,
  //         })),
  //       };
  //     } else {
  //       // If interests array is empty, we don't need to add anything
  //       delete updateData.interests;
  //     }
  //   } else {
  //     // If interests is not provided in the update, don't modify it
  //     delete updateData.interests;
  //   }

  //   const updatedUser = await this.db.user.update({
  //     where: { id: userId },
  //     data: updateData,
  //   });

  //   return updatedUser;
  // }

  generateOtp() {
    const fallback = Math.floor(100000 + Math.random() * 900000);
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });

    return String(otp || fallback);
  }

  async sendOtp(email: string, subject?: string) {
    const otp = this.generateOtp();
    await this.db.otp.deleteMany({
      where: {
        email: email,
      },
    });

    await this.db.otp.create({
      data: {
        email: email.toString(),
        otp: await bcrypt.hash(otp, 10),
      },
    });
    await this.mailService.sendEmail({
      to: email.toString(),
      subject: subject || 'Verify your account',
      body: otp.toString(),
    });
    console.log('[OTP]', otp);
    return {
      message: 'OTP sent to your email',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.db.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
      });
    }

    await this.sendOtp(email, 'Verify your account');

    return {
      message: 'OTP sent to your email',
    };
  }

  async resetPassword({
    password,
    token,
    otp,
  }: {
    password: string;
    token: string;
    otp: string;
    type: 'reset' | 'verify';
  }) {
    const decoded = await this.jwtService.verifyAsync(token, {
      secret: process.env.ONE_TIME_JWT_SECRET,
    });

    const email = decoded?.email as string;
    if (!email) {
      throw new BadRequestException({
        message: 'Invalid token',
      });
    }

    await this.verifyOtp(email, otp, 'verify');

    const user = await this.db.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.db.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
    return {
      message: 'Password reset successfully',
    };
  }

  async verifyOtp(
    email: string,
    otp: string,
    type: 'reset' | 'verify' = 'verify',
  ) {
    const _otp = await this.db.otp.findFirst({
      where: {
        email: email,
      },
    });

    if (!_otp) {
      throw new BadRequestException({
        message: 'Invalid OTP',
      });
    }

    const isOtpExpired =
      new Date().getTime() - _otp.created_at.getTime() > 1000 * 60 * 5;

    if (isOtpExpired) {
      throw new BadRequestException({
        message: 'OTP expired',
      });
    }

    const isOtpValid = await bcrypt.compare(otp, _otp.otp);

    if (!isOtpValid) {
      throw new BadRequestException({
        message: 'Invalid OTP',
      });
    }

    if (type === 'verify') {
      await this.db.otp.delete({
        where: { id: _otp.id },
      });
    }

    const oneTimeToken = await this.jwtService.signAsync(
      {
        email: email,
      },
      {
        secret: process.env.ONE_TIME_JWT_SECRET,
        expiresIn: '5m',
      },
    );

    return {
      message: 'OTP verified successfully',
      token: oneTimeToken,
    };
  }

  async login(user: { id: string }) {
    const payload = { sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
      }),
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
          username: `${profile.firstName.toLowerCase()}_${profile.lastName.toLowerCase()}_${Date.now()}`,
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
          username: `${(profile.name?.firstName || 'user').toLowerCase()}_${(profile.name?.lastName || 'apple').toLowerCase()}_${Date.now()}`,
          auth_provider: 'apple',
        },
      });
    }

    return this.login({
      id: user.id,
    });
  }
}
