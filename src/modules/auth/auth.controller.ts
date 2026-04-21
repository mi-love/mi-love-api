import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { GoogleUser } from '@/common/types/o-auth-user';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { User } from '@/common/decorator/user.decorator';
import {
  CreateAdminUserDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SendOtpDto,
  SignupDto,
  VerifyOtpDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    return this.authService.login({
      id: user.id,
    });
  }

  @Post('admin/login')
  async adminLogin(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    return this.authService.login({
      id: user.id,
      email: user.email,
      is_admin: true,
      admin_role: 'super_admin',
    });
  }

  @Post('admin/create-user')
  async createAdminUser(@Body() data: CreateAdminUserDto) {
    return this.authService.createAdminUser(data);
  }

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('send-otp')
  async sendOtp(@Body() body: SendOtpDto) {
    if (body.check_exists == true) {
      const exists = await this.authService.checkUserExists(body.email);
      if (exists) {
        throw new BadRequestException({
          message: 'User already exists',
        });
      }
    }

    return this.authService.sendOtp(body.email);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.email, body.otp, body.type);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword({
      password: body.password,
      token: body.token,
      otp: body.otp,
    });
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.googleLogin(req.user as GoogleUser);
    return res.redirect(
      `${process.env.EXPO_SCHEME}/auth/login?token=${result.access_token}`,
    );
  }

  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth() {}

  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.appleLogin(req.user);
    res.redirect(
      `${process.env.EXPO_SCHEME}/auth/login?token=${result.access_token}`,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@User() user: any) {
    return this.authService.logout(user.id);
  }
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    return this.authService.login({
      id: user.id,
      email: user.email,
      is_admin: true,
      admin_role: 'super_admin',
    });
  }

  @Post('create-user')
  async createAdminUser(@Body() data: CreateAdminUserDto) {
    return this.authService.createAdminUser(data);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async adminLogout(@User() user: any) {
    return this.authService.logout(user.id);
  }
}
