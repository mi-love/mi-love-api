import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DbService } from '@/database/database.service';
import { JwtService } from '@nestjs/jwt';
import { GoogleUser } from '@/common/types/o-auth-user';
import { CreateAdminUserDto, SignupDto } from './auth.dto';
import { admin_role, gender } from '@prisma/client';
import { MailService } from '@/common/services/mail.service';
import { InterestService } from '@/common/services/interest.service';
import otpGenerator from 'otp-generator';

const authUserSelect = {
  id: true,
  email: true,
  password: true,
  auth_provider: true,
};

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwtService: JwtService,
    private interestUtils: InterestService,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    let user:
      | { id: string; email: string; password: string | null; auth_provider: string }
      | null = null;

    try {
      const prismaUser = await this.db.user.findUnique({
        where: { email },
        select: authUserSelect,
      });

      user = prismaUser
        ? {
            id: prismaUser.id,
            email: prismaUser.email,
            password: prismaUser.password,
            auth_provider: String(prismaUser.auth_provider),
          }
        : null;
    } catch {
      const rows = await this.db.$queryRaw<
        Array<{
          id: string;
          email: string;
          password: string | null;
          auth_provider: string;
        }>
      >`
        SELECT "id", "email", "password", "auth_provider"
        FROM "users"
        WHERE "email" = ${email}
        LIMIT 1
      `;
      user = rows?.[0] || null;
    }

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
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "users"
      WHERE "email" = ${email}
      LIMIT 1
    `;

    return rows.length > 0;
  }

  async checkUsernameExists(username: string) {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "users"
      WHERE "username" = ${username}
      LIMIT 1
    `;

    return rows.length > 0;
  }

  async verifyOneTimeToken(token: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.ONE_TIME_JWT_SECRET,
      });
      return decoded;
    } catch {
      return false;
    }
  }

  async signup(signupDto: SignupDto) {
    const decoded = await this.verifyOneTimeToken(signupDto.token);

    if (!decoded) {
      throw new BadRequestException({
        message: 'Invalid token',
      });
    }

    if (decoded.email !== signupDto.email) {
      throw new BadRequestException({
        message: 'Invalid token',
      });
    }

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
        username: signupDto.username,
        emergency_contact: signupDto.emergency_contact,
        bio: signupDto.bio,
        profile_picture: {
          connect: {
            id: checkProfilePicture.id,
          },
        },
        wallet: {
          create: {
            balance: 0,
          },
        },
        home_address: signupDto.home_address,
        date_of_birth: new Date(signupDto?.date_of_birth),
      },
    });

    await this.interestUtils.addAndUpdateInterests(
      signupDto?.interests?.slice(0, 15),
      {
        userId: user.id,
      },
    );

    return this.login({
      id: user.id,
    });
  }

  async createAdminUser(data: CreateAdminUserDto) {
    const existingUser = await this.checkUserExists(data.email);
    if (existingUser) {
      throw new BadRequestException({
        message: 'User with this email already exists',
      });
    }

    const existingUsername = await this.checkUsernameExists(data.username);
    if (existingUsername) {
      throw new BadRequestException({
        message: 'Username already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    let user: { id: string; email: string; username: string };

    try {
      user = await this.db.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          country: data.country,
          phone_number: data.phone_number,
          auth_provider: 'local',
          is_admin: true,
          admin_role: admin_role.super_admin,
          wallet: {
            create: {
              balance: 0,
            },
          },
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });
    } catch {
      // Fallback for databases that do not yet have admin columns.
      const wallet = await this.db.wallet.create({
        data: { balance: 0 },
        select: { id: true },
      });

      const userId = randomUUID();
      const inserted = await this.db.$queryRaw<
        Array<{ id: string; email: string; username: string }>
      >`
        INSERT INTO "users" (
          "id",
          "email",
          "first_name",
          "last_name",
          "username",
          "password",
          "country",
          "phone_number",
          "auth_provider",
          "walletId",
          "created_at",
          "updated_at"
        )
        VALUES (
          ${userId},
          ${data.email},
          ${data.first_name},
          ${data.last_name},
          ${data.username},
          ${hashedPassword},
          ${data.country || null},
          ${data.phone_number || null},
          'local',
          ${wallet.id},
          NOW(),
          NOW()
        )
        RETURNING "id", "email", "username"
      `;

      if (!inserted?.[0]) {
        throw new BadRequestException({
          message: 'Unable to create admin user',
        });
      }

      user = inserted[0];
    }

    const token = await this.login({
      id: user.id,
      email: user.email,
      is_admin: true,
      admin_role: admin_role.super_admin,
    });

    return {
      message: 'Admin user created successfully',
      user,
      ...token,
    };
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
      lowerCaseAlphabets: false,
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
    this.mailService
      .sendEmail({
        to: email.toString(),
        subject: subject || 'Verify your account',
        body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Verify your account</h2>
        <p style="font-size: 16px; color: #666;">Your verification code is:</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; color: #28a745;">
          ${otp}
        </div>
      </div>`,
      })
      .catch(() => null);
    console.log('[OTP]', otp);
    return {
      message: 'OTP sent to your email',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true },
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
  }) {
    const decoded = await this.verifyOneTimeToken(token);

    const email = decoded?.email as string;
    if (!email) {
      throw new BadRequestException({
        message: 'Invalid token',
      });
    }

    await this.verifyOtp(email, otp, 'verify');

    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true },
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

  async login(user: {
    id: string;
    is_admin?: boolean;
    admin_role?: string;
    email?: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      is_admin: Boolean(user.is_admin),
      admin_role: user.admin_role,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async logout(userId: string) {
    await this.db.session.deleteMany({ where: { userId } });
    return { message: 'Logged out successfully' };
  }

  async googleLogin(profile: GoogleUser) {
    let user = await this.db.user.findUnique({
      where: {
        email: profile.email,
      },
      select: { id: true },
    });

    if (!user) {
      user = await this.db.user.create({
        data: {
          email: profile.email,
          first_name: profile.firstName,
          last_name: profile.lastName,
          wallet: {
            create: {
              balance: 0,
            },
          },
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
      select: { id: true },
    });

    if (!user) {
      user = await this.db.user.create({
        data: {
          email: profile.email,
          first_name: profile.name?.firstName || '',
          last_name: profile.name?.lastName || '',
          wallet: {
            create: {
              balance: 0,
            },
          },
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
