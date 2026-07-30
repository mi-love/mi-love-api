import { post_visibility } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class createPostDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(post_visibility)
  visibility: post_visibility;

  @IsArray()
  @IsOptional()
  files: string[];
}

export class getPostsDto {
  filterValue: string;

  filterBy: 'all' | 'my' | 'liked';

  limit: number;
  page: number;

  order: 'desc' | 'asc';
}

export class updatePostDto {
  @IsEnum(post_visibility)
  @IsOptional()
  visibility: post_visibility;

  content: string;
}

export class createCommentDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}
