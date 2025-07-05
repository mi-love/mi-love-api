import { gender } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsJWT,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class EditProfileDto {
  @IsString()
  @IsOptional()
  first_name: string;

  @IsString()
  @IsOptional()
  last_name: string;

  @IsString()
  @IsOptional()
  username: string;

  @IsString()
  @IsOptional()
  country: string;

  @IsString()
  @IsOptional()
  phone_number: string;

  @IsString()
  @IsOptional()
  profile_picture: string;

  @IsString()
  @IsOptional()
  emergency_contact: string;

  @IsDateString()
  @IsOptional()
  date_of_birth: string;

  @IsString()
  @IsOptional()
  home_address: string;

  @IsString()
  @IsOptional()
  @IsEnum(gender)
  gender: gender;

  @IsString()
  @IsOptional()
  bio: string;

  @IsArray()
  @IsOptional()
  added_interests: string[];

  @IsArray()
  @IsOptional()
  removed_interests: string[];
}

export class DeleteProfileDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @IsJWT({
    message: 'Invalid token',
  })
  token: string;
}
