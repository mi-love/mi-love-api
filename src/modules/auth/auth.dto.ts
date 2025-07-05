import { gender } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsJWT,
  IsNotEmpty,
  IsString,
} from 'class-validator';

enum otp_type {
  reset = 'reset',
  verify = 'verify',
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class SendOtpDto extends ForgotPasswordDto {}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyOtpDto extends ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(otp_type)
  type: otp_type;
}

export class SignupDto extends LoginDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @IsJWT({
    message: 'Invalid token',
  })
  token: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  emergency_contact: string;

  @IsString()
  @IsNotEmpty()
  bio: string;

  @IsString()
  @IsNotEmpty()
  profile_picture: string;

  @IsString()
  @IsNotEmpty()
  home_address: string;

  @IsArray()
  @IsNotEmpty()
  interests: string[];

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(gender)
  gender: gender;

  @IsDateString()
  @IsNotEmpty()
  date_of_birth: string;
}
