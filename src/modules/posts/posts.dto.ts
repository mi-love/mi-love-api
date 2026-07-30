import { post_visibility } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class createPostDto {
  /** Caption — optional when at least one media file is attached (video posts). */
  @ValidateIf((o: createPostDto) => !o.files?.length)
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content?: string;

  @IsEnum(post_visibility)
  @IsOptional()
  visibility?: post_visibility;

  /** File IDs from `POST /upload` (images and/or videos). */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  files?: string[];
}

export class getPostsDto {
  filterValue: string;

  filterBy: 'all' | 'my' | 'liked';

  limit: number;
  page: number;

  order: 'desc' | 'asc';
}

export class getVideoFeedDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  /** Cursor: return videos older than this post id (infinite scroll). */
  @IsOptional()
  @IsString()
  cursor?: string;
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
